"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { authenticate, can, hashPassword, type Permission, type Role } from "@/server/auth/core";
import { endSession, requireAdminPage, startSession } from "@/server/auth/current";
import { ApiError, clientIp } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { db } from "@/server/db";
import { contactMessages, shippingMethods, shippingZones, users } from "@/server/db/schema";
import { parseNairaInput } from "@/lib/format";
import { audit } from "@/server/services/audit";
import {
  addVariant,
  adjustStock,
  createCategory,
  createProduct,
  deleteCategory,
  deleteVariant,
  importProductsCsv,
  setProductStatus,
  stopTrackingStock,
  updateCategory,
  updateProduct,
  updateVariant,
} from "@/server/services/admin-catalogue";
import { deleteImage, processAndStoreUpload, setPrimaryImage, updateImageMeta } from "@/server/services/images";
import { addOrderNote, addShipment, confirmOrderShipping, recordManualPayment, updateOrderStatus } from "@/server/services/orders";
import { createSupplier, deleteSupplier, deleteSupplierProduct, testSupplierConnection, updateSupplier, upsertSupplierProduct } from "@/server/services/suppliers";
import { updateSettings } from "@/server/services/settings";
import { deletePromotion, savePolicy, savePromotion, type PolicySlug, POLICY_SLUGS } from "@/server/services/content";
import { methodSchema, zoneSchema } from "@/server/services/shipping";

export type AdminFormState = { error?: string } | undefined;

/* ───────── helpers ───────── */
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" ? null : v;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const int = (fd: FormData, k: string, d = 0) => {
  const v = str(fd, k);
  if (v === "") return d;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new ApiError(400, "BAD_REQUEST", `${k} must be a whole number`);
  return n;
};
const naira = (fd: FormData, k: string) => {
  try {
    return parseNairaInput(fd.get(k));
  } catch {
    throw new ApiError(400, "BAD_REQUEST", `Invalid amount for ${k.replace(/Kobo|Naira/g, "")}`);
  }
};

function back(fd: FormData, fallback: string) {
  const b = str(fd, "back");
  return b.startsWith("/admin") && !b.startsWith("//") ? b : fallback;
}
function withParam(url: string, key: string, value: string) {
  const [path, q = ""] = url.split("?");
  const p = new URLSearchParams(q);
  p.delete("ok");
  p.delete("error");
  p.set(key, value.slice(0, 300));
  return `${path}?${p.toString()}`;
}
function errMessage(e: unknown) {
  if (e instanceof ZodError) {
    const f = e.flatten();
    const first = Object.entries(f.fieldErrors)[0] as [string, string[]] | undefined;
    return first ? `${first[0]}: ${first[1][0]}` : (f.formErrors[0] ?? "Invalid input");
  }
  if (e instanceof ApiError) return e.message;
  console.error("[admin action]", e);
  return "Something went wrong. Please try again.";
}

/** Run an admin mutation with permission check, then redirect back with a flash message. */
async function run(perm: Permission, fd: FormData, fallback: string, fn: (actor: { id: string; email: string; role: Role }) => Promise<string | { redirect: string; message: string }>) {
  const actor = await requireAdminPage(perm);
  const to = back(fd, fallback);
  let result: string | { redirect: string; message: string };
  try {
    result = await fn({ id: actor.id, email: actor.email, role: actor.role });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    redirect(withParam(to, "error", errMessage(e)));
  }
  revalidatePath("/", "layout");
  if (typeof result === "string") redirect(withParam(to, "ok", result));
  redirect(withParam(result.redirect, "ok", result.message));
}

/* ───────── auth ───────── */
export async function adminLoginAction(_: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const h = await headers();
  const ip = clientIp(h);
  if (!rateLimit(`admin-login:${ip}`, 8, 15 * 60_000).allowed) return { error: "Too many attempts. Please wait 15 minutes." };
  const email = str(fd, "email").slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const r = await authenticate(email, password);
  if (!r.ok) {
    await audit(null, "admin.login_failed", "user", null, { email, ip, reason: r.reason });
    return { error: r.reason === "LOCKED" ? "Account temporarily locked after repeated failures. Try again in 15 minutes." : "Invalid credentials." };
  }
  if (!can(r.user.role, "admin:access")) {
    await audit({ id: r.user.id, email: r.user.email }, "admin.login_denied", "user", r.user.id, { ip });
    return { error: "Invalid credentials." };
  }
  await startSession(r.user);
  await audit({ id: r.user.id, email: r.user.email }, "admin.login", "user", r.user.id, { ip });
  redirect("/admin");
}

export async function adminLogoutAction() {
  await endSession();
  redirect("/admin/login");
}

/* ───────── products ───────── */
function productFromForm(fd: FormData) {
  const specs: { label: string; value: string }[] = [];
  for (const line of str(fd, "specifications").split("\n")) {
    const [label, ...rest] = line.split(":");
    if (label?.trim() && rest.join(":").trim()) specs.push({ label: label.trim(), value: rest.join(":").trim() });
  }
  const retail = naira(fd, "retailPrice");
  if (retail == null) throw new ApiError(400, "BAD_REQUEST", "Retail price is required");
  return {
    name: str(fd, "name"),
    slug: str(fd, "slug") || undefined,
    sku: str(fd, "sku"),
    categoryId: str(fd, "categoryId"),
    description: str(fd, "description"),
    keywords: str(fd, "keywords"),
    specifications: specs,
    status: str(fd, "status") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    isFeatured: bool(fd, "isFeatured"),
    retailPriceKobo: retail,
    salePriceKobo: naira(fd, "salePrice"),
    basePlanningPriceKobo: fd.has("basePlanningPrice") ? naira(fd, "basePlanningPrice") : undefined,
    verificationStatus: str(fd, "verificationStatus") as "UNVERIFIED" | "SUPPLIER_VERIFIED",
    pricingNote: opt(fd, "pricingNote"),
    trackInventory: bool(fd, "trackInventory"),
    stockStatus: (str(fd, "stockStatus") || "UNKNOWN") as "UNKNOWN" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK",
    lowStockThreshold: int(fd, "lowStockThreshold", 5),
    seoTitle: opt(fd, "seoTitle"),
    seoDescription: opt(fd, "seoDescription"),
  };
}

export async function createProductAction(fd: FormData) {
  await run("catalogue:write", fd, "/admin/products/new", async (a) => {
    const p = await createProduct(productFromForm(fd), a);
    return { redirect: `/admin/products/${p.id}`, message: "Product created" };
  });
}

export async function updateProductAction(fd: FormData) {
  const id = str(fd, "id");
  await run("catalogue:write", fd, `/admin/products/${id}`, async (a) => {
    await updateProduct(id, productFromForm(fd), a);
    return "Product saved";
  });
}

export async function bulkStatusAction(fd: FormData) {
  await run("catalogue:write", fd, "/admin/products", async (a) => {
    const ids = fd.getAll("ids").map(String).filter(Boolean);
    const status = str(fd, "bulkStatus") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
    if (!ids.length) throw new ApiError(400, "BAD_REQUEST", "Select at least one product");
    if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) throw new ApiError(400, "BAD_REQUEST", "Choose an action");
    const n = await setProductStatus(ids, status, a);
    return `${n} product(s) set to ${status.toLowerCase()}`;
  });
}

export async function importCsvAction(fd: FormData) {
  await run("catalogue:write", fd, "/admin/products", async (a) => {
    const f = fd.get("file");
    if (!(f instanceof File) || f.size === 0) throw new ApiError(400, "BAD_REQUEST", "Choose a CSV file");
    if (f.size > 2_000_000) throw new ApiError(400, "BAD_REQUEST", "CSV must be under 2 MB");
    const r = await importProductsCsv(await f.text(), a);
    return `Import finished: ${r.updated} updated, ${r.skipped.length} skipped, ${r.errors.length} errors${r.errors.length ? ` (${r.errors.slice(0, 3).join("; ")})` : ""}`;
  });
}

export async function addVariantAction(fd: FormData) {
  const productId = str(fd, "productId");
  await run("catalogue:write", fd, `/admin/products/${productId}`, async (a) => {
    const options: Record<string, string> = {};
    for (const pair of str(fd, "options").split(",")) {
      const [k, v] = pair.split("=").map((s) => s?.trim());
      if (k && v) options[k] = v;
    }
    await addVariant(productId, { name: str(fd, "name"), sku: str(fd, "sku"), options, priceOverrideKobo: naira(fd, "priceOverride"), isActive: true, position: int(fd, "position", 0) }, a);
    return "Variant added";
  });
}

export async function toggleVariantAction(fd: FormData) {
  const productId = str(fd, "productId");
  await run("catalogue:write", fd, `/admin/products/${productId}`, async (a) => {
    await updateVariant(
      str(fd, "variantId"),
      { name: str(fd, "name"), sku: str(fd, "sku"), options: JSON.parse(str(fd, "options") || "{}"), priceOverrideKobo: naira(fd, "priceOverride"), isActive: bool(fd, "isActive"), trackInventory: bool(fd, "trackInventory"), stockQuantity: opt(fd, "stockQuantity") == null ? null : int(fd, "stockQuantity"), position: int(fd, "position", 0) },
      a,
    );
    return "Variant updated";
  });
}

export async function deleteVariantAction(fd: FormData) {
  const productId = str(fd, "productId");
  await run("catalogue:write", fd, `/admin/products/${productId}`, async (a) => {
    await deleteVariant(str(fd, "variantId"), a);
    return "Variant deleted";
  });
}

export async function adjustStockAction(fd: FormData) {
  const productId = str(fd, "productId");
  await run("inventory:write", fd, `/admin/products/${productId}`, async (a) => {
    const q = await adjustStock(productId, { mode: str(fd, "mode") as "set" | "adjust", quantity: int(fd, "quantity"), reason: str(fd, "reason"), variantId: opt(fd, "variantId") }, a);
    return `Stock is now ${q}`;
  });
}

export async function untrackStockAction(fd: FormData) {
  const productId = str(fd, "productId");
  await run("inventory:write", fd, `/admin/products/${productId}`, async (a) => {
    await stopTrackingStock(productId, a);
    return "Stock tracking turned off";
  });
}

/* ───────── images ───────── */
function imageMeta(fd: FormData) {
  return {
    altText: str(fd, "altText"),
    sourceType: str(fd, "sourceType") as never,
    sourceName: opt(fd, "sourceName"),
    sourcePageUrl: opt(fd, "sourcePageUrl"),
    licenseStatus: str(fd, "licenseStatus") as never,
    verificationStatus: str(fd, "verificationStatus") as never,
    notes: opt(fd, "notes"),
  };
}

export async function uploadImageAction(fd: FormData) {
  const productId = str(fd, "productId");
  await run("catalogue:write", fd, `/admin/products/${productId}`, async (a) => {
    await processAndStoreUpload(productId, fd.get("file") as File, imageMeta(fd), a, bool(fd, "makePrimary"));
    return "Image uploaded";
  });
}

export async function updateImageAction(fd: FormData) {
  await run("catalogue:write", fd, "/admin/images", async (a) => {
    await updateImageMeta(str(fd, "imageId"), imageMeta(fd), a);
    return "Image details saved";
  });
}

export async function primaryImageAction(fd: FormData) {
  await run("catalogue:write", fd, "/admin/images", async (a) => {
    await setPrimaryImage(str(fd, "imageId"), a);
    return "Primary image updated";
  });
}

export async function deleteImageAction(fd: FormData) {
  await run("catalogue:write", fd, "/admin/images", async (a) => {
    await deleteImage(str(fd, "imageId"), a);
    return "Image deleted";
  });
}

/* ───────── categories ───────── */
function categoryFromForm(fd: FormData) {
  return { name: str(fd, "name"), slug: str(fd, "slug") || undefined, description: opt(fd, "description"), icon: opt(fd, "icon"), position: int(fd, "position", 0), isActive: bool(fd, "isActive") };
}
export async function saveCategoryAction(fd: FormData) {
  await run("catalogue:write", fd, "/admin/categories", async (a) => {
    const id = opt(fd, "id");
    if (id) await updateCategory(id, categoryFromForm(fd), a);
    else await createCategory(categoryFromForm(fd), a);
    return id ? "Category saved" : "Category created";
  });
}
export async function deleteCategoryAction(fd: FormData) {
  await run("settings:write", fd, "/admin/categories", async (a) => {
    await deleteCategory(str(fd, "id"), a);
    return "Category deleted";
  });
}

/* ───────── orders ───────── */
export async function orderStatusAction(fd: FormData) {
  const id = str(fd, "orderId");
  await run("orders:write", fd, `/admin/orders/${id}`, async (a) => {
    await updateOrderStatus(id, { status: str(fd, "status") as never, note: opt(fd, "note") }, a);
    return "Order status updated";
  });
}
export async function orderShippingAction(fd: FormData) {
  const id = str(fd, "orderId");
  await run("orders:write", fd, `/admin/orders/${id}`, async (a) => {
    const fee = naira(fd, "shippingFee");
    if (fee == null) throw new ApiError(400, "BAD_REQUEST", "Enter the delivery fee (0 for free delivery)");
    await confirmOrderShipping(id, { shippingKobo: fee, note: opt(fd, "note") }, a);
    return "Delivery fee confirmed";
  });
}
export async function orderNoteAction(fd: FormData) {
  const id = str(fd, "orderId");
  await run("orders:write", fd, `/admin/orders/${id}`, async (a) => {
    await addOrderNote(id, str(fd, "body"), a);
    return "Note added";
  });
}
export async function orderShipmentAction(fd: FormData) {
  const id = str(fd, "orderId");
  await run("orders:write", fd, `/admin/orders/${id}`, async (a) => {
    await addShipment(id, { carrier: str(fd, "carrier"), trackingNumber: opt(fd, "trackingNumber"), trackingUrl: opt(fd, "trackingUrl"), notes: opt(fd, "notes") }, a);
    return "Shipment details recorded";
  });
}
export async function manualPaymentAction(fd: FormData) {
  const id = str(fd, "orderId");
  await run("orders:write", fd, `/admin/orders/${id}`, async (a) => {
    const amount = naira(fd, "amount");
    await recordManualPayment(id, { method: str(fd, "method") as never, amountKobo: amount ?? 0, externalReference: str(fd, "externalReference"), confirmation: bool(fd, "confirmation") as true }, a);
    return "Manual payment recorded (audited)";
  });
}

/* ───────── suppliers ───────── */
function supplierFromForm(fd: FormData) {
  return {
    name: str(fd, "name"),
    website: opt(fd, "website"),
    contactName: opt(fd, "contactName"),
    contactEmail: opt(fd, "contactEmail"),
    contactPhone: opt(fd, "contactPhone"),
    country: opt(fd, "country"),
    notes: opt(fd, "notes"),
    integrationType: (str(fd, "integrationType") || "MANUAL") as "MANUAL" | "API",
    integrationStatus: (str(fd, "integrationStatus") || "NOT_CONFIGURED") as never,
    adapterKey: opt(fd, "adapterKey"),
    isApproved: bool(fd, "isApproved"),
  };
}
export async function saveSupplierAction(fd: FormData) {
  await run("suppliers:write", fd, "/admin/suppliers", async (a) => {
    const id = opt(fd, "id");
    if (id) {
      await updateSupplier(id, supplierFromForm(fd), a);
      return "Supplier saved";
    }
    const s = await createSupplier(supplierFromForm(fd), a);
    return { redirect: `/admin/suppliers/${s.id}`, message: "Supplier created" };
  });
}
export async function deleteSupplierAction(fd: FormData) {
  await run("suppliers:write", fd, "/admin/suppliers", async (a) => {
    await deleteSupplier(str(fd, "id"), a);
    return { redirect: "/admin/suppliers", message: "Supplier deleted" };
  });
}
export async function supplierProductAction(fd: FormData) {
  await run("suppliers:write", fd, "/admin/suppliers", async (a) => {
    const currency = (str(fd, "costCurrency") || "NGN").toUpperCase();
    const costRaw = str(fd, "cost").replace(/[,\s₦$]/g, "");
    if (costRaw && !/^\d+(\.\d{1,2})?$/.test(costRaw)) throw new ApiError(400, "BAD_REQUEST", "Invalid supplier cost");
    await upsertSupplierProduct(
      {
        supplierId: str(fd, "supplierId"),
        productId: str(fd, "productId"),
        supplierSku: opt(fd, "supplierSku"),
        supplierProductUrl: opt(fd, "supplierProductUrl"),
        costMinor: costRaw ? Math.round(Number(costRaw) * 100) : null,
        costCurrency: currency,
        additionalCostsKobo: naira(fd, "additionalCosts"),
        additionalCostsNote: opt(fd, "additionalCostsNote"),
        costVerified: bool(fd, "costVerified"),
        deliveryEstimateText: opt(fd, "deliveryEstimateText"),
        deliveryEstimateSource: opt(fd, "deliveryEstimateSource"),
        notes: opt(fd, "notes"),
      },
      a,
    );
    return "Supplier product reference saved";
  });
}
export async function deleteSupplierProductAction(fd: FormData) {
  await run("suppliers:write", fd, "/admin/suppliers", async (a) => {
    await deleteSupplierProduct(str(fd, "refId"), a);
    return "Reference removed";
  });
}
export async function testSupplierAction(fd: FormData) {
  await run("suppliers:write", fd, "/admin/suppliers", async (a) => {
    const r = await testSupplierConnection(str(fd, "id"), a);
    return r.ok ? `Configuration check: ${r.data.message}` : `Configuration check failed: ${r.error}`;
  });
}

/* ───────── settings ───────── */
export async function storeSettingsAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings", async (a) => {
    await updateSettings(
      {
        storeName: str(fd, "storeName"),
        legalName: str(fd, "legalName"),
        rcNumber: str(fd, "rcNumber"),
        tagline: str(fd, "tagline"),
        supportEmail: str(fd, "supportEmail"),
        addressLines: str(fd, "addressLines").split("\n").map((s) => s.trim()).filter(Boolean),
        logoUrl: opt(fd, "logoUrl"),
        announcement: str(fd, "announcement"),
        heroTitle: str(fd, "heroTitle"),
        heroSubtitle: str(fd, "heroSubtitle"),
        showUnverifiedNotice: bool(fd, "showUnverifiedNotice"),
      },
      a.id,
    );
    await audit(a, "settings.update", "settings", "store");
    return "Store settings saved";
  });
}

export async function orderModeAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings", async (a) => {
    const mode = str(fd, "orderMode") as "REQUEST" | "LIVE";
    await updateSettings({ orderMode: mode }, a.id);
    await audit(a, "settings.order_mode", "settings", "orderMode", { mode });
    return `Order mode set to ${mode}`;
  });
}

export async function saveZoneAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings/shipping", async (a) => {
    const d = zoneSchema.parse({ name: str(fd, "name"), countries: ["NG"], states: fd.getAll("states").map(String), isActive: bool(fd, "isActive") });
    const id = opt(fd, "id");
    if (id) await db.update(shippingZones).set(d).where(eq(shippingZones.id, id));
    else await db.insert(shippingZones).values(d);
    await audit(a, id ? "shipping.zone_update" : "shipping.zone_create", "shipping_zone", id, { name: d.name });
    return "Shipping zone saved";
  });
}

export async function saveMethodAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings/shipping", async (a) => {
    const fee = naira(fd, "fee");
    const d = methodSchema.parse({
      zoneId: str(fd, "zoneId"),
      name: str(fd, "name"),
      description: opt(fd, "description"),
      feeKobo: fee,
      feeConfirmed: bool(fd, "feeConfirmed") && fee != null,
      freeOverKobo: naira(fd, "freeOver"),
      estimatedDeliveryText: opt(fd, "estimatedDeliveryText"),
      isActive: bool(fd, "isActive"),
      position: int(fd, "position", 0),
    });
    const id = opt(fd, "id");
    if (id) await db.update(shippingMethods).set(d).where(eq(shippingMethods.id, id));
    else await db.insert(shippingMethods).values(d);
    await audit(a, id ? "shipping.method_update" : "shipping.method_create", "shipping_method", id, { name: d.name, feeKobo: d.feeKobo, feeConfirmed: d.feeConfirmed });
    return "Delivery method saved";
  });
}

export async function deleteMethodAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings/shipping", async (a) => {
    const id = str(fd, "id");
    await db.delete(shippingMethods).where(eq(shippingMethods.id, id));
    await audit(a, "shipping.method_delete", "shipping_method", id);
    return "Delivery method deleted";
  });
}

export async function savePromotionAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings/promotions", async (a) => {
    await savePromotion(
      opt(fd, "id"),
      {
        title: str(fd, "title"),
        subtitle: opt(fd, "subtitle"),
        badge: opt(fd, "badge"),
        ctaLabel: opt(fd, "ctaLabel"),
        ctaHref: opt(fd, "ctaHref"),
        placement: (str(fd, "placement") || "HOME_STRIP") as "HOME_STRIP" | "HOME_HERO",
        isActive: bool(fd, "isActive"),
        startsAt: opt(fd, "startsAt") as never,
        endsAt: opt(fd, "endsAt") as never,
        position: int(fd, "position", 0),
      },
      a,
    );
    return "Promotion saved";
  });
}

export async function deletePromotionAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings/promotions", async (a) => {
    await deletePromotion(str(fd, "id"), a);
    return "Promotion deleted";
  });
}

export async function savePolicyAction(fd: FormData) {
  await run("settings:write", fd, "/admin/settings/policies", async (a) => {
    const slug = str(fd, "slug") as PolicySlug;
    if (!POLICY_SLUGS.includes(slug)) throw new ApiError(400, "BAD_REQUEST", "Unknown policy");
    await savePolicy(slug, { title: str(fd, "title"), body: String(fd.get("body") ?? ""), isReviewed: bool(fd, "isReviewed") }, a);
    return "Policy saved";
  });
}

export async function messageStatusAction(fd: FormData) {
  await run("orders:write", fd, "/admin/messages", async (a) => {
    const id = str(fd, "id");
    await db.update(contactMessages).set({ status: str(fd, "status") === "RESOLVED" ? "RESOLVED" : "NEW" }).where(eq(contactMessages.id, id));
    await audit(a, "contact.status", "contact_message", id);
    return "Message updated";
  });
}

/* ───────── users ───────── */
export async function createStaffAction(fd: FormData) {
  await run("users:manage", fd, "/admin/users", async (a) => {
    const role = str(fd, "role") as Role;
    if (!["STAFF", "ADMIN"].includes(role)) throw new ApiError(400, "BAD_REQUEST", "Invalid role");
    const password = String(fd.get("password") ?? "");
    const { validatePasswordStrength, findUserByEmail, normaliseEmail } = await import("@/server/auth/core");
    const err = validatePasswordStrength(password);
    if (err) throw new ApiError(400, "BAD_REQUEST", err);
    const email = normaliseEmail(str(fd, "email"));
    if (!email.includes("@")) throw new ApiError(400, "BAD_REQUEST", "Enter a valid email");
    if (await findUserByEmail(email)) throw new ApiError(409, "CONFLICT", "A user with this email already exists");
    const [u] = await db.insert(users).values({ email, name: str(fd, "name") || email, role, passwordHash: await hashPassword(password) }).returning({ id: users.id });
    await audit(a, "user.create_staff", "user", u.id, { email, role });
    return "Team member created";
  });
}

export async function setUserRoleAction(fd: FormData) {
  await run("users:manage", fd, "/admin/users", async (a) => {
    const id = str(fd, "id");
    const role = str(fd, "role") as Role;
    if (id === a.id) throw new ApiError(400, "BAD_REQUEST", "You cannot change your own role");
    if (!["CUSTOMER", "STAFF", "ADMIN"].includes(role)) throw new ApiError(400, "BAD_REQUEST", "Invalid role");
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
    await audit(a, "user.role", "user", id, { role });
    return "Role updated";
  });
}

export async function setUserActiveAction(fd: FormData) {
  await run("users:manage", fd, "/admin/users", async (a) => {
    const id = str(fd, "id");
    if (id === a.id) throw new ApiError(400, "BAD_REQUEST", "You cannot deactivate yourself");
    const active = bool(fd, "active");
    await db.update(users).set({ isActive: active, updatedAt: new Date() }).where(eq(users.id, id));
    await audit(a, active ? "user.activate" : "user.deactivate", "user", id);
    return active ? "User activated" : "User deactivated";
  });
}
