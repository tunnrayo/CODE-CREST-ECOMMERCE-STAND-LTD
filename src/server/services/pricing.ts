import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "../db";
import { categories, productImages, productVariants, products } from "../db/schema";
import { FALLBACK_IMAGE } from "./catalogue";

export const MAX_LINE_QTY = 99;

export type RequestedLine = { productId: string; variantId: string | null; quantity: number; itemId?: string };

export type QuotedLine = {
  itemId?: string;
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  slug: string;
  variantName: string | null;
  imageUrl: string;
  imageAlt: string;
  unitPriceKobo: number;
  retailPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
  maxQuantity: number;
  verificationStatus: "UNVERIFIED" | "SUPPLIER_VERIFIED";
  trackInventory: boolean;
  problem: string | null;
};

/**
 * Authoritative server-side pricing & availability for a set of lines.
 * Prices always come from the database — never from the client.
 * Pass `lock: true` inside a transaction to lock product rows (stock safety).
 */
export async function quoteLines(lines: RequestedLine[], opts: { tx?: Tx; lock?: boolean } = {}): Promise<{ lines: QuotedLine[]; subtotalKobo: number; hasProblems: boolean }> {
  const runner = opts.tx ?? db;
  if (!lines.length) return { lines: [], subtotalKobo: 0, hasProblems: false };
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const variantIds = [...new Set(lines.map((l) => l.variantId).filter((v): v is string => !!v))];

  const baseQuery = runner
    .select({ p: products, catActive: categories.isActive })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(products.id, productIds));
  const prodRows = opts.lock ? await baseQuery.for("update", { of: products }) : await baseQuery;
  const pmap = new Map(prodRows.map((r) => [r.p.id, r]));

  const varRows = variantIds.length
    ? opts.lock
      ? await runner.select().from(productVariants).where(inArray(productVariants.id, variantIds)).for("update")
      : await runner.select().from(productVariants).where(inArray(productVariants.id, variantIds))
    : [];
  const vmap = new Map(varRows.map((v) => [v.id, v]));

  const imgs = await runner
    .select({ productId: productImages.productId, url: productImages.url, alt: productImages.altText })
    .from(productImages)
    .where(and(inArray(productImages.productId, productIds), eq(productImages.isPrimary, true)));
  const imap = new Map(imgs.map((i) => [i.productId, i]));

  const out: QuotedLine[] = [];
  for (const l of lines) {
    const row = pmap.get(l.productId);
    if (!row) {
      out.push({ ...emptyLine(l), problem: "This product is no longer available." });
      continue;
    }
    const p = row.p;
    const v = l.variantId ? vmap.get(l.variantId) : null;
    let problem: string | null = null;
    if (p.status !== "PUBLISHED" || !row.catActive) problem = "This product is not currently available.";
    if (l.variantId && (!v || v.productId !== p.id || !v.isActive)) problem = "The selected option is no longer available.";
    if (p.stockStatus === "OUT_OF_STOCK") problem = "Out of stock.";

    let maxQuantity = MAX_LINE_QTY;
    const tracked = v ? v.trackInventory : p.trackInventory;
    const stockQty = v ? v.stockQuantity : p.stockQuantity;
    if (tracked && stockQty != null) {
      maxQuantity = Math.min(MAX_LINE_QTY, stockQty);
      if (stockQty <= 0) problem = "Out of stock.";
      else if (l.quantity > stockQty) problem = `Only ${stockQty} available.`;
    }
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_LINE_QTY) problem = `Quantity must be between 1 and ${MAX_LINE_QTY}.`;

    const unit = v?.priceOverrideKobo ?? p.salePriceKobo ?? p.retailPriceKobo;
    const img = imap.get(p.id);
    out.push({
      itemId: l.itemId,
      productId: p.id,
      variantId: v?.id ?? null,
      sku: v?.sku ?? p.sku,
      name: p.name,
      slug: p.slug,
      variantName: v?.name ?? null,
      imageUrl: img?.url ?? FALLBACK_IMAGE,
      imageAlt: img?.alt ?? p.name,
      unitPriceKobo: unit,
      retailPriceKobo: v?.priceOverrideKobo ?? p.retailPriceKobo,
      quantity: l.quantity,
      lineTotalKobo: unit * l.quantity,
      maxQuantity,
      verificationStatus: p.verificationStatus,
      trackInventory: !!tracked && stockQty != null,
      problem,
    });
  }
  const subtotalKobo = out.filter((l) => !l.problem).reduce((s, l) => s + l.lineTotalKobo, 0);
  return { lines: out, subtotalKobo, hasProblems: out.some((l) => l.problem) };
}

function emptyLine(l: RequestedLine): QuotedLine {
  return {
    itemId: l.itemId,
    productId: l.productId,
    variantId: l.variantId,
    sku: "",
    name: "Unavailable product",
    slug: "",
    variantName: null,
    imageUrl: FALLBACK_IMAGE,
    imageAlt: "Unavailable product",
    unitPriceKobo: 0,
    retailPriceKobo: 0,
    quantity: l.quantity,
    lineTotalKobo: 0,
    maxQuantity: 0,
    verificationStatus: "UNVERIFIED",
    trackInventory: false,
    problem: null,
  };
}
