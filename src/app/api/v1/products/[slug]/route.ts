import { notFound, ok, route } from "@/server/http";
import { getProductBySlug, getRelatedProducts } from "@/server/services/catalogue";

export const dynamic = "force-dynamic";

/** GET /api/v1/products/:slug — public product detail (published only). Internal fields are excluded. */
export const GET = route<{ slug: string }>(async (_req, { params }) => {
  const p = await getProductBySlug(params.slug);
  if (!p) throw notFound("Product not found");
  const related = await getRelatedProducts(p, 4);
  return ok({
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    description: p.description,
    specifications: p.specifications,
    category: p.category,
    currency: p.currency,
    priceKobo: p.priceKobo,
    retailPriceKobo: p.retailPriceKobo,
    salePriceKobo: p.salePriceKobo,
    verificationStatus: p.verificationStatus,
    stockStatus: p.stockStatus,
    images: p.images.map((i) => ({ url: i.url, alt: i.altText, isPrimary: i.isPrimary, sourceType: i.sourceType })),
    variants: p.variants.filter((v) => v.isActive).map((v) => ({ id: v.id, sku: v.sku, name: v.name, options: v.options, priceKobo: v.priceOverrideKobo ?? p.priceKobo, available: !(v.trackInventory && (v.stockQuantity ?? 0) <= 0) })),
    related: related.map((r) => ({ slug: r.slug, name: r.name, priceKobo: r.priceKobo, image: r.image.url })),
  });
});
