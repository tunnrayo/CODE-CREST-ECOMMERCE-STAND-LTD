import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { integrationLogs, products, supplierProducts, suppliers } from "../db/schema";
import { notFound } from "../http";
import { getAdapter } from "../suppliers/registry";
import { audit, type Actor } from "./audit";

const optStr = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  website: z.string().trim().url().max(300).optional().nullable().or(z.literal("").transform(() => null)),
  contactName: optStr(120),
  contactEmail: z.string().trim().email().max(200).optional().nullable().or(z.literal("").transform(() => null)),
  contactPhone: optStr(40),
  country: optStr(60),
  notes: optStr(2000),
  integrationType: z.enum(["MANUAL", "API"]).default("MANUAL"),
  integrationStatus: z.enum(["NOT_CONFIGURED", "IN_REVIEW", "TEST", "ACTIVE", "DISABLED"]).default("NOT_CONFIGURED"),
  adapterKey: optStr(60),
  isApproved: z.boolean().default(false),
});

export const supplierProductSchema = z.object({
  supplierId: z.string().uuid(),
  productId: z.string().uuid(),
  supplierSku: optStr(80),
  supplierProductUrl: z.string().trim().url().max(500).optional().nullable().or(z.literal("").transform(() => null)),
  costMinor: z.number().int().min(0).nullable().optional(),
  costCurrency: z.string().trim().length(3).toUpperCase().default("NGN"),
  additionalCostsKobo: z.number().int().min(0).nullable().optional(),
  additionalCostsNote: optStr(300),
  costVerified: z.boolean().default(false),
  deliveryEstimateText: optStr(120),
  deliveryEstimateSource: optStr(200),
  notes: optStr(1000),
});

export async function listSuppliers() {
  return db
    .select({
      s: suppliers,
      productCount: sql<number>`(select count(*)::int from ${supplierProducts} sp where sp.supplier_id = "suppliers"."id")`,
      verifiedCount: sql<number>`(select count(*)::int from ${supplierProducts} sp where sp.supplier_id = "suppliers"."id" and sp.cost_verified_at is not null)`,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(id: string) {
  const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  if (!s) return null;
  const refs = await db
    .select({ ref: supplierProducts, productName: products.name, productSku: products.sku, retailPriceKobo: products.retailPriceKobo, productId: products.id })
    .from(supplierProducts)
    .innerJoin(products, eq(products.id, supplierProducts.productId))
    .where(eq(supplierProducts.supplierId, id))
    .orderBy(asc(products.sku));
  const logs = await db.select().from(integrationLogs).where(eq(integrationLogs.supplierId, id)).orderBy(desc(integrationLogs.createdAt)).limit(20);
  return { ...s, refs, logs };
}

export async function createSupplier(input: z.input<typeof supplierSchema>, actor: Actor) {
  const data = supplierSchema.parse(input);
  const [s] = await db.insert(suppliers).values(data).returning();
  await audit(actor, "supplier.create", "supplier", s.id, { name: s.name });
  return s;
}

export async function updateSupplier(id: string, input: z.input<typeof supplierSchema>, actor: Actor) {
  const data = supplierSchema.parse(input);
  const [s] = await db.update(suppliers).set({ ...data, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning();
  if (!s) throw notFound("Supplier not found");
  await audit(actor, "supplier.update", "supplier", id, { integrationStatus: data.integrationStatus, isApproved: data.isApproved });
  return s;
}

export async function deleteSupplier(id: string, actor: Actor) {
  await db.delete(suppliers).where(eq(suppliers.id, id));
  await audit(actor, "supplier.delete", "supplier", id);
}

export async function upsertSupplierProduct(input: z.input<typeof supplierProductSchema>, actor: Actor) {
  const d = supplierProductSchema.parse(input);
  const values = {
    supplierId: d.supplierId,
    productId: d.productId,
    supplierSku: d.supplierSku,
    supplierProductUrl: d.supplierProductUrl ?? null,
    costMinor: d.costMinor ?? null,
    costCurrency: d.costCurrency,
    additionalCostsKobo: d.additionalCostsKobo ?? null,
    additionalCostsNote: d.additionalCostsNote,
    costVerifiedAt: d.costVerified && d.costMinor != null ? new Date() : null,
    deliveryEstimateText: d.deliveryEstimateText,
    deliveryEstimateSource: d.deliveryEstimateSource,
    notes: d.notes,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(supplierProducts)
    .values(values)
    .onConflictDoUpdate({ target: [supplierProducts.supplierId, supplierProducts.productId], set: values })
    .returning();
  await audit(actor, "supplier_product.upsert", "product", d.productId, { supplierId: d.supplierId, costMinor: d.costMinor, costCurrency: d.costCurrency, verified: d.costVerified });
  return row;
}

export async function deleteSupplierProduct(id: string, actor: Actor) {
  const [r] = await db.delete(supplierProducts).where(eq(supplierProducts.id, id)).returning();
  if (r) await audit(actor, "supplier_product.delete", "product", r.productId, { supplierId: r.supplierId });
}

export async function supplierRefsForProduct(productId: string) {
  return db
    .select({ ref: supplierProducts, supplierName: suppliers.name, integrationStatus: suppliers.integrationStatus })
    .from(supplierProducts)
    .innerJoin(suppliers, eq(suppliers.id, supplierProducts.supplierId))
    .where(eq(supplierProducts.productId, productId));
}

/**
 * Margin is only calculated when a verified NGN supplier cost exists.
 * Included expenses: supplier cost + recorded additional procurement/shipping
 * costs. Excluded: payment fees, taxes, delivery to customer, overheads.
 */
export function calculateMargin(retailKobo: number, ref: { costMinor: number | null; costCurrency: string; additionalCostsKobo: number | null; costVerifiedAt: Date | null } | null | undefined) {
  if (!ref || ref.costMinor == null || !ref.costVerifiedAt) return { available: false as const, reason: "No verified supplier cost recorded." };
  if (ref.costCurrency !== "NGN") return { available: false as const, reason: `Supplier cost is in ${ref.costCurrency}; margin needs a confirmed exchange rate.` };
  const cost = ref.costMinor + (ref.additionalCostsKobo ?? 0);
  const marginKobo = retailKobo - cost;
  return {
    available: true as const,
    costKobo: cost,
    marginKobo,
    marginPercent: retailKobo > 0 ? Math.round((marginKobo / retailKobo) * 1000) / 10 : 0,
    includes: "Supplier cost + recorded additional procurement/shipping costs. Excludes payment fees, taxes, customer delivery and overheads.",
  };
}

export async function testSupplierConnection(id: string, actor: Actor) {
  const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  if (!s) throw notFound("Supplier not found");
  const adapter = getAdapter(s.adapterKey);
  const res = await adapter.checkConfiguration();
  await db.insert(integrationLogs).values({
    supplierId: id,
    action: "checkConfiguration",
    status: res.ok ? "OK" : "ERROR",
    message: res.ok ? res.data.message : res.error,
  });
  await audit(actor, "supplier.check", "supplier", id, { adapter: adapter.key, ok: res.ok });
  return { adapter: adapter.key, ...res };
}
