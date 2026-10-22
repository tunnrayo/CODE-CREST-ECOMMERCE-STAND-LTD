import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { categories, productImages, productVariants, products } from "../db/schema";

export const FALLBACK_IMAGE = "/brand/product-fallback.svg";

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional().transform((v) => (v ? v : undefined)),
  category: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
  minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(), // naira
  maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(), // naira
  sort: z.enum(["featured", "price_asc", "price_desc", "name_asc", "name_desc", "newest"]).default("featured"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
  featured: z
    .union([z.literal("true"), z.literal("1"), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === "true" || v === "1")),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export type ProductCard = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  category: { slug: string; name: string };
  priceKobo: number;
  retailPriceKobo: number;
  salePriceKobo: number | null;
  currency: string;
  image: { url: string; alt: string; sourceType: string };
  verificationStatus: "UNVERIFIED" | "SUPPLIER_VERIFIED";
  stockStatus: "UNKNOWN" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  isFeatured: boolean;
  createdAt: Date;
};

const effectivePrice = sql<number>`coalesce(${products.salePriceKobo}, ${products.retailPriceKobo})`;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function searchCondition(q: string): SQL {
  const like = `%${escapeLike(q)}%`;
  return sql`(
    to_tsvector('english', ${products.name} || ' ' || ${products.description} || ' ' || ${products.keywords}) @@ websearch_to_tsquery('english', ${q})
    OR ${products.name} ILIKE ${like}
    OR ${products.keywords} ILIKE ${like}
    OR ${products.sku} ILIKE ${like}
    OR ${categories.name} ILIKE ${like}
  )`;
}

export async function listProducts(input: Partial<ListQuery> & { statuses?: ("DRAFT" | "PUBLISHED" | "ARCHIVED")[] } = {}) {
  const query = listQuerySchema.parse(input);
  const statuses = input.statuses ?? ["PUBLISHED"];
  const conds: SQL[] = [inArray(products.status, statuses)];
  if (statuses.length === 1 && statuses[0] === "PUBLISHED") conds.push(eq(categories.isActive, true));
  if (query.category) conds.push(eq(categories.slug, query.category));
  if (query.q) conds.push(searchCondition(query.q));
  if (query.minPrice != null) conds.push(sql`${effectivePrice} >= ${query.minPrice * 100}`);
  if (query.maxPrice != null) conds.push(sql`${effectivePrice} <= ${query.maxPrice * 100}`);
  if (query.featured !== undefined) conds.push(eq(products.isFeatured, query.featured));
  const where = and(...conds);

  const order = {
    featured: [desc(products.isFeatured), asc(categories.position), asc(products.sku)],
    price_asc: [asc(effectivePrice), asc(products.name)],
    price_desc: [desc(effectivePrice), asc(products.name)],
    name_asc: [asc(products.name)],
    name_desc: [desc(products.name)],
    newest: [desc(products.createdAt), desc(products.sku)],
  }[query.sort];

  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where);

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      description: products.description,
      retailPriceKobo: products.retailPriceKobo,
      salePriceKobo: products.salePriceKobo,
      currency: products.currency,
      verificationStatus: products.verificationStatus,
      stockStatus: products.stockStatus,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(...order)
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  const items = await attachPrimaryImages(rows);
  return {
    items,
    total: Number(total),
    page: query.page,
    perPage: query.perPage,
    pageCount: Math.max(1, Math.ceil(Number(total) / query.perPage)),
    query,
  };
}

type CardRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  retailPriceKobo: number;
  salePriceKobo: number | null;
  currency: string;
  verificationStatus: "UNVERIFIED" | "SUPPLIER_VERIFIED";
  stockStatus: "UNKNOWN" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  isFeatured: boolean;
  createdAt: Date;
  categorySlug: string;
  categoryName: string;
};

async function attachPrimaryImages(rows: CardRow[]): Promise<ProductCard[]> {
  const ids = rows.map((r) => r.id);
  const imgs = ids.length
    ? await db
        .select({ productId: productImages.productId, url: productImages.url, alt: productImages.altText, isPrimary: productImages.isPrimary, position: productImages.position, sourceType: productImages.sourceType })
        .from(productImages)
        .where(inArray(productImages.productId, ids))
        .orderBy(desc(productImages.isPrimary), asc(productImages.position))
    : [];
  const byProduct = new Map<string, (typeof imgs)[number]>();
  for (const i of imgs) if (!byProduct.has(i.productId)) byProduct.set(i.productId, i);
  return rows.map((r) => {
    const img = byProduct.get(r.id);
    return {
      id: r.id,
      sku: r.sku,
      slug: r.slug,
      name: r.name,
      description: r.description,
      category: { slug: r.categorySlug, name: r.categoryName },
      priceKobo: r.salePriceKobo ?? r.retailPriceKobo,
      retailPriceKobo: r.retailPriceKobo,
      salePriceKobo: r.salePriceKobo,
      currency: r.currency,
      image: img ? { url: img.url, alt: img.alt, sourceType: img.sourceType } : { url: FALLBACK_IMAGE, alt: `${r.name} — image coming soon`, sourceType: "PLACEHOLDER" },
      verificationStatus: r.verificationStatus,
      stockStatus: r.stockStatus,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt,
    };
  });
}

export async function getProductBySlug(slug: string, opts: { includeUnpublished?: boolean } = {}) {
  const [row] = await db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), opts.includeUnpublished ? undefined : eq(products.status, "PUBLISHED")))
    .limit(1);
  if (!row) return null;
  return hydrateProduct(row.product, row.category);
}

export async function getProductById(id: string) {
  const [row] = await db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id))
    .limit(1);
  if (!row) return null;
  return hydrateProduct(row.product, row.category);
}

async function hydrateProduct(product: typeof products.$inferSelect, category: typeof categories.$inferSelect) {
  const [images, variants] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(desc(productImages.isPrimary), asc(productImages.position)),
    db.select().from(productVariants).where(eq(productVariants.productId, product.id)).orderBy(asc(productVariants.position), asc(productVariants.name)),
  ]);
  return {
    ...product,
    priceKobo: product.salePriceKobo ?? product.retailPriceKobo,
    category: { id: category.id, slug: category.slug, name: category.name },
    images: images.length
      ? images
      : [{ id: "fallback", url: FALLBACK_IMAGE, altText: `${product.name} — image coming soon`, isPrimary: true, sourceType: "PLACEHOLDER" as const, verificationStatus: "NEEDS_REPLACEMENT" as const, licenseStatus: "OWNED" as const, sourceName: null, sourcePageUrl: null, position: 0, width: null, height: null, storageKey: null, notes: null, productId: product.id, createdAt: new Date() }],
    variants,
  };
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function getRelatedProducts(product: { id: string; categoryId: string; retailPriceKobo: number }, limit = 4) {
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      description: products.description,
      retailPriceKobo: products.retailPriceKobo,
      salePriceKobo: products.salePriceKobo,
      currency: products.currency,
      verificationStatus: products.verificationStatus,
      stockStatus: products.stockStatus,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.categoryId, product.categoryId), ne(products.id, product.id), eq(products.status, "PUBLISHED")))
    .orderBy(sql`abs(${products.retailPriceKobo} - ${product.retailPriceKobo})`, asc(products.name))
    .limit(limit);
  return attachPrimaryImages(rows);
}

export async function listCategories(opts: { includeInactive?: boolean } = {}) {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      icon: categories.icon,
      code: categories.code,
      position: categories.position,
      isActive: categories.isActive,
      productCount: sql<number>`(select count(*)::int from ${products} p where p.category_id = "categories"."id" and p.status = 'PUBLISHED')`,
    })
    .from(categories)
    .where(opts.includeInactive ? undefined : eq(categories.isActive, true))
    .orderBy(asc(categories.position), asc(categories.name));
  return rows;
}

export async function getCategoryBySlug(slug: string) {
  const [c] = await db.select().from(categories).where(and(eq(categories.slug, slug), eq(categories.isActive, true))).limit(1);
  return c ?? null;
}

export async function getPriceBounds() {
  const [r] = await db
    .select({ min: sql<number>`min(${effectivePrice})`, max: sql<number>`max(${effectivePrice})` })
    .from(products)
    .where(eq(products.status, "PUBLISHED"));
  return { minKobo: Number(r?.min ?? 0), maxKobo: Number(r?.max ?? 0) };
}
