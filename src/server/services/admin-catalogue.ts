import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { slugify } from "@/lib/catalogue-rules";
import { db } from "../db";
import { categories, inventoryMovements, productImages, productVariants, products } from "../db/schema";
import { badRequest, conflict, notFound } from "../http";
import { audit, type Actor } from "./audit";
import { refreshStockStatus } from "./orders";

const nullableInt = z.number().int().min(0).max(1_000_000_000).nullable();

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: z.string().trim().max(100).regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes").optional(),
    sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9-_]+$/),
    categoryId: z.string().uuid(),
    description: z.string().trim().max(5000).default(""),
    keywords: z.string().trim().max(500).default(""),
    specifications: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) })).max(30).default([]),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    isFeatured: z.boolean().default(false),
    retailPriceKobo: z.number().int().min(0).max(1_000_000_000),
    salePriceKobo: nullableInt.default(null),
    basePlanningPriceKobo: nullableInt.optional(),
    verificationStatus: z.enum(["UNVERIFIED", "SUPPLIER_VERIFIED"]),
    pricingNote: z.string().trim().max(500).nullable().optional(),
    trackInventory: z.boolean().default(false),
    stockStatus: z.enum(["UNKNOWN", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).default("UNKNOWN"),
    lowStockThreshold: z.number().int().min(0).max(10000).default(5),
    seoTitle: z.string().trim().max(70).nullable().optional(),
    seoDescription: z.string().trim().max(160).nullable().optional(),
  })
  .refine((v) => v.salePriceKobo == null || v.salePriceKobo < v.retailPriceKobo, { message: "Sale price must be lower than the retail price", path: ["salePriceKobo"] });
export type ProductInput = z.infer<typeof productInputSchema>;

export const adminProductListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  verification: z.enum(["UNVERIFIED", "SUPPLIER_VERIFIED"]).optional(),
  stock: z.enum(["UNKNOWN", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});

export async function adminListProducts(input: Partial<z.infer<typeof adminProductListSchema>>) {
  const q = adminProductListSchema.parse(input);
  const conds: SQL[] = [];
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, "\\$&")}%`;
    conds.push(or(ilike(products.name, like), ilike(products.sku, like), ilike(products.keywords, like))!);
  }
  if (q.category) conds.push(eq(categories.slug, q.category));
  if (q.status) conds.push(eq(products.status, q.status));
  if (q.verification) conds.push(eq(products.verificationStatus, q.verification));
  if (q.stock) conds.push(eq(products.stockStatus, q.stock));
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(products).innerJoin(categories, eq(categories.id, products.categoryId)).where(where);
  const rows = await db
    .select({
      p: products,
      categoryName: categories.name,
      categorySlug: categories.slug,
      imageUrl: sql<string | null>`(select url from ${productImages} i where i.product_id = "products"."id" and i.is_primary limit 1)`,
      imageCount: sql<number>`(select count(*)::int from ${productImages} i where i.product_id = "products"."id")`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(asc(products.sku))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage);
  return { items: rows, total: Number(total), page: q.page, perPage: q.perPage, pageCount: Math.max(1, Math.ceil(Number(total) / q.perPage)) };
}

async function ensureUnique(field: "slug" | "sku", value: string, exceptId?: string) {
  const col = field === "slug" ? products.slug : products.sku;
  const [r] = await db.select({ id: products.id }).from(products).where(eq(col, value)).limit(1);
  if (r && r.id !== exceptId) throw conflict(`A product with this ${field} already exists.`);
}

export async function createProduct(input: z.input<typeof productInputSchema>, actor: Actor) {
  const d = productInputSchema.parse(input);
  const slug = d.slug || slugify(d.name);
  await ensureUnique("slug", slug);
  await ensureUnique("sku", d.sku);
  const [p] = await db
    .insert(products)
    .values({
      ...d,
      slug,
      stockQuantity: null,
      publishedAt: d.status === "PUBLISHED" ? new Date() : null,
      catalogueSource: "Admin",
    })
    .returning();
  await audit(actor, "product.create", "product", p.id, { sku: p.sku, name: p.name });
  return p;
}

export async function updateProduct(id: string, input: z.input<typeof productInputSchema>, actor: Actor) {
  const d = productInputSchema.parse(input);
  const [before] = await db.select().from(products).where(eq(products.id, id));
  if (!before) throw notFound("Product not found");
  const slug = d.slug || before.slug;
  await ensureUnique("slug", slug, id);
  await ensureUnique("sku", d.sku, id);
  const [p] = await db
    .update(products)
    .set({
      ...d,
      slug,
      basePlanningPriceKobo: d.basePlanningPriceKobo === undefined ? before.basePlanningPriceKobo : d.basePlanningPriceKobo,
      publishedAt: d.status === "PUBLISHED" ? (before.publishedAt ?? new Date()) : before.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();
  const changes: Record<string, unknown> = {};
  for (const k of ["retailPriceKobo", "salePriceKobo", "status", "verificationStatus", "name", "categoryId", "isFeatured"] as const) {
    if (before[k] !== p[k]) changes[k] = { from: before[k], to: p[k] };
  }
  await audit(actor, "product.update", "product", id, changes);
  return p;
}

export async function setProductStatus(ids: string[], status: "DRAFT" | "PUBLISHED" | "ARCHIVED", actor: Actor) {
  if (!ids.length) return 0;
  const rows = await db
    .update(products)
    .set({ status, updatedAt: new Date(), ...(status === "PUBLISHED" ? { publishedAt: sql`coalesce(${products.publishedAt}, now())` } : {}) })
    .where(inArray(products.id, ids))
    .returning({ id: products.id });
  await audit(actor, "product.status", "product", ids.length === 1 ? ids[0] : null, { ids, status });
  return rows.length;
}

/* ── Variants ── */
export const variantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(2).max(50).regex(/^[A-Za-z0-9-_]+$/),
  options: z.record(z.string().max(30), z.string().max(60)).default({}),
  priceOverrideKobo: nullableInt.default(null),
  trackInventory: z.boolean().default(false),
  stockQuantity: z.number().int().min(0).max(1_000_000).nullable().default(null),
  isActive: z.boolean().default(true),
  position: z.number().int().default(0),
});

export async function addVariant(productId: string, input: z.input<typeof variantSchema>, actor: Actor) {
  const d = variantSchema.parse(input);
  const [exists] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, d.sku));
  if (exists) throw conflict("A variant with this SKU already exists.");
  const [v] = await db.insert(productVariants).values({ ...d, productId }).returning();
  await audit(actor, "variant.create", "product", productId, { variantId: v.id, sku: v.sku });
  return v;
}

export async function updateVariant(variantId: string, input: z.input<typeof variantSchema>, actor: Actor) {
  const d = variantSchema.parse(input);
  const [v] = await db.update(productVariants).set(d).where(eq(productVariants.id, variantId)).returning();
  if (!v) throw notFound("Variant not found");
  await audit(actor, "variant.update", "product", v.productId, { variantId });
  return v;
}

export async function deleteVariant(variantId: string, actor: Actor) {
  const [v] = await db.delete(productVariants).where(eq(productVariants.id, variantId)).returning();
  if (v) await audit(actor, "variant.delete", "product", v.productId, { variantId });
}

/* ── Inventory ── */
export const stockAdjustSchema = z.object({
  mode: z.enum(["set", "adjust"]),
  quantity: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.string().trim().min(2).max(200),
  variantId: z.string().uuid().nullable().optional(),
});

export async function adjustStock(productId: string, input: z.input<typeof stockAdjustSchema>, actor: Actor) {
  const d = stockAdjustSchema.parse(input);
  return db.transaction(async (tx) => {
    if (d.variantId) {
      const [v] = await tx.select().from(productVariants).where(and(eq(productVariants.id, d.variantId), eq(productVariants.productId, productId))).for("update");
      if (!v) throw notFound("Variant not found");
      const current = v.stockQuantity ?? 0;
      const next = d.mode === "set" ? d.quantity : current + d.quantity;
      if (next < 0) throw badRequest("Stock cannot go below zero.");
      await tx.update(productVariants).set({ stockQuantity: next, trackInventory: true }).where(eq(productVariants.id, v.id));
      await tx.insert(inventoryMovements).values({ productId, variantId: v.id, delta: next - current, reason: d.reason, actorUserId: actor?.id ?? null });
      await audit(actor, "inventory.adjust", "product", productId, { variantId: v.id, from: v.stockQuantity, to: next, reason: d.reason }, tx);
      return next;
    }
    const [p] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    if (!p) throw notFound("Product not found");
    const current = p.stockQuantity ?? 0;
    const next = d.mode === "set" ? d.quantity : current + d.quantity;
    if (next < 0) throw badRequest("Stock cannot go below zero.");
    await tx.update(products).set({ stockQuantity: next, trackInventory: true, updatedAt: new Date() }).where(eq(products.id, productId));
    await refreshStockStatus(tx, productId);
    await tx.insert(inventoryMovements).values({ productId, delta: next - current, reason: d.reason, actorUserId: actor?.id ?? null });
    await audit(actor, "inventory.adjust", "product", productId, { from: p.stockQuantity, to: next, reason: d.reason }, tx);
    return next;
  });
}

export async function stopTrackingStock(productId: string, actor: Actor) {
  await db.update(products).set({ trackInventory: false, stockQuantity: null, stockStatus: "UNKNOWN", updatedAt: new Date() }).where(eq(products.id, productId));
  await audit(actor, "inventory.untrack", "product", productId);
}

export async function inventoryOverview() {
  const rows = await db
    .select({ p: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(sql`${products.status} <> 'ARCHIVED'`)
    .orderBy(asc(products.sku));
  const tracked = rows.filter((r) => r.p.trackInventory && r.p.stockQuantity != null);
  return {
    rows,
    trackedCount: tracked.length,
    untrackedCount: rows.length - tracked.length,
    lowStock: tracked.filter((r) => r.p.stockQuantity! > 0 && r.p.stockQuantity! <= r.p.lowStockThreshold),
    outOfStock: rows.filter((r) => r.p.stockStatus === "OUT_OF_STOCK"),
  };
}

export async function recentMovements(productId?: string, limit = 50) {
  return db
    .select({ m: inventoryMovements, productName: products.name, sku: products.sku })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .where(productId ? eq(inventoryMovements.productId, productId) : undefined)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(limit);
}

/* ── Categories ── */
export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).regex(/^[a-z0-9-]*$/).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  position: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export async function createCategory(input: z.input<typeof categorySchema>, actor: Actor) {
  const d = categorySchema.parse(input);
  const slug = d.slug || slugify(d.name);
  const [ex] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (ex) throw conflict("A category with this slug already exists.");
  const [c] = await db.insert(categories).values({ ...d, slug }).returning();
  await audit(actor, "category.create", "category", c.id, { name: c.name });
  return c;
}

export async function updateCategory(id: string, input: z.input<typeof categorySchema>, actor: Actor) {
  const d = categorySchema.parse(input);
  const slug = d.slug || slugify(d.name);
  const [ex] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (ex && ex.id !== id) throw conflict("A category with this slug already exists.");
  const [c] = await db.update(categories).set({ ...d, slug, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
  if (!c) throw notFound("Category not found");
  await audit(actor, "category.update", "category", id, { name: c.name, isActive: c.isActive });
  return c;
}

export async function deleteCategory(id: string, actor: Actor) {
  const [{ n }] = await db.select({ n: count() }).from(products).where(eq(products.categoryId, id));
  if (Number(n) > 0) throw conflict("This category still has products. Move or archive them first, or deactivate the category instead.");
  await db.delete(categories).where(eq(categories.id, id));
  await audit(actor, "category.delete", "category", id);
}

/* ── CSV export / import ── */
const CSV_COLUMNS = ["sku", "slug", "name", "category_slug", "status", "verification_status", "base_planning_price_ngn", "retail_price_ngn", "sale_price_ngn", "description"] as const;

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportProductsCsv() {
  const rows = await db.select({ p: products, cat: categories.slug }).from(products).innerJoin(categories, eq(categories.id, products.categoryId)).orderBy(asc(products.sku));
  const lines = [CSV_COLUMNS.join(",")];
  for (const { p, cat } of rows) {
    lines.push(
      [
        p.sku,
        p.slug,
        p.name,
        cat,
        p.status,
        p.verificationStatus,
        p.basePlanningPriceKobo != null ? p.basePlanningPriceKobo / 100 : "",
        p.retailPriceKobo / 100,
        p.salePriceKobo != null ? p.salePriceKobo / 100 : "",
        p.description,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some((x) => x !== "")) rows.push(row);
  }
  return rows;
}

/**
 * Import updates EXISTING products matched by SKU (price, sale price, status,
 * verification, name, description). Unknown SKUs are reported, not created.
 */
export async function importProductsCsv(text: string, actor: Actor) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw badRequest("The CSV file has no data rows.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  if (idx("sku") < 0 || idx("retail_price_ngn") < 0) throw badRequest("CSV must include at least sku and retail_price_ngn columns.");
  const results = { updated: 0, skipped: [] as string[], errors: [] as string[] };
  for (const r of rows.slice(1)) {
    const sku = r[idx("sku")]?.trim();
    if (!sku) continue;
    const [p] = await db.select().from(products).where(eq(products.sku, sku));
    if (!p) {
      results.skipped.push(`${sku}: not found`);
      continue;
    }
    try {
      const num = (k: string) => {
        const i = idx(k);
        if (i < 0) return undefined;
        const v = (r[i] ?? "").replace(/[₦,\s]/g, "");
        if (v === "") return null;
        if (!/^\d+(\.\d{1,2})?$/.test(v)) throw new Error(`invalid ${k}`);
        return Math.round(Number(v) * 100);
      };
      const retail = num("retail_price_ngn");
      const sale = num("sale_price_ngn");
      const status = idx("status") >= 0 ? (r[idx("status")] || p.status).trim().toUpperCase() : p.status;
      const ver = idx("verification_status") >= 0 ? (r[idx("verification_status")] || p.verificationStatus).trim().toUpperCase() : p.verificationStatus;
      await updateProduct(
        p.id,
        {
          name: idx("name") >= 0 && r[idx("name")]?.trim() ? r[idx("name")].trim() : p.name,
          slug: p.slug,
          sku: p.sku,
          categoryId: p.categoryId,
          description: idx("description") >= 0 ? (r[idx("description")] ?? "").trim() : p.description,
          keywords: p.keywords,
          specifications: p.specifications,
          status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
          isFeatured: p.isFeatured,
          retailPriceKobo: retail ?? p.retailPriceKobo,
          salePriceKobo: sale === undefined ? p.salePriceKobo : sale,
          verificationStatus: ver as "UNVERIFIED" | "SUPPLIER_VERIFIED",
          pricingNote: p.pricingNote,
          trackInventory: p.trackInventory,
          stockStatus: p.stockStatus,
          lowStockThreshold: p.lowStockThreshold,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
        },
        actor,
      );
      results.updated++;
    } catch (e) {
      results.errors.push(`${sku}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  await audit(actor, "product.csv_import", "product", null, { updated: results.updated, skipped: results.skipped.length, errors: results.errors.length });
  return results;
}

export async function getImageReport() {
  const rows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      status: products.status,
      image: productImages,
    })
    .from(products)
    .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
    .orderBy(asc(products.sku));
  const summary = {
    total: rows.length,
    verified: rows.filter((r) => r.image?.verificationStatus === "VERIFIED").length,
    pendingPermission: rows.filter((r) => r.image && r.image.verificationStatus === "PENDING").length,
    illustration: rows.filter((r) => r.image?.sourceType === "ORIGINAL_ILLUSTRATION").length,
    needsImage: rows.filter((r) => !r.image || r.image.verificationStatus === "NEEDS_REPLACEMENT").length,
  };
  return { rows, summary };
}
