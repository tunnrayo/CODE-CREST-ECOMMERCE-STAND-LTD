import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, Mail, RotateCcw, Truck } from "lucide-react";
import { Breadcrumbs, Notice } from "@/components/ui";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { ProductGrid } from "@/components/product/ProductCard";
import { StockBadge, VerificationBadge } from "@/components/product/Badges";
import { WishlistButton } from "@/components/product/WishlistButton";
import { getProductBySlug, getRelatedProducts } from "@/server/services/catalogue";
import { getCurrentUser } from "@/server/auth/current";
import { wishlistFor } from "@/server/services/accounts";
import { getSettings } from "@/server/services/settings";
import { absoluteUrl } from "@/lib/site";
import { formatKobo } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const title = p.seoTitle || `${p.name} — ${p.category.name}`;
  const description = p.seoDescription || `${p.description} ${formatKobo(p.priceKobo)} at Code Crest.`.slice(0, 160);
  const image = p.images[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title, description, url: `/product/${p.slug}`, images: image ? [{ url: image, width: 800, height: 800, alt: p.images[0].altText }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [related, user, settings] = await Promise.all([getRelatedProducts(product, 4), getCurrentUser(), getSettings()]);
  const wish = user ? new Set((await wishlistFor(user.id)).map((w) => w.productId)) : undefined;
  const outOfStock = product.stockStatus === "OUT_OF_STOCK" || (product.trackInventory && product.stockQuantity != null && product.stockQuantity <= 0);
  const maxQty = product.trackInventory && product.stockQuantity != null ? Math.max(1, Math.min(99, product.stockQuantity)) : 99;
  const verified = product.verificationStatus === "SUPPLIER_VERIFIED";

  // Structured data: only facts we hold. Offer data only for supplier-verified products.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category.name,
    image: product.images.filter((i) => i.sourceType !== "PLACEHOLDER").map((i) => absoluteUrl(i.url)),
    url: absoluteUrl(`/product/${product.slug}`),
  };
  if (verified) {
    jsonLd.offers = {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: (product.priceKobo / 100).toFixed(2),
      url: absoluteUrl(`/product/${product.slug}`),
      ...(product.trackInventory && product.stockQuantity != null ? { availability: product.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } : {}),
    };
  }

  return (
    <div className="container-x py-6 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: product.category.name, href: `/category/${product.category.slug}` }, { label: product.name }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images.map((i) => ({ id: i.id, url: i.url, altText: i.altText, sourceType: i.sourceType }))} name={product.name} />

        <div>
          <Link href={`/category/${product.category.slug}`} className="text-xs font-semibold uppercase tracking-wide text-lime-700 hover:underline">
            {product.category.name}
          </Link>
          <h1 className="mt-2 text-2xl leading-tight sm:text-3xl" data-testid="product-title">
            {product.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VerificationBadge status={product.verificationStatus} />
            <StockBadge status={product.stockStatus} />
            <span className="text-xs text-grey-500">SKU: {product.sku}</span>
          </div>

          <div className="mt-6">
            <PurchasePanel
              productId={product.id}
              priceKobo={product.priceKobo}
              retailPriceKobo={product.retailPriceKobo}
              variants={product.variants.map((v) => ({ id: v.id, name: v.name, options: v.options, priceOverrideKobo: v.priceOverrideKobo, isActive: v.isActive, trackInventory: v.trackInventory, stockQuantity: v.stockQuantity }))}
              outOfStock={outOfStock}
              maxQty={maxQty}
            />
          </div>
          <div className="mt-4">
            <WishlistButton productId={product.id} initial={!!wish?.has(product.id)} signedIn={!!user} withLabel />
          </div>

          {!verified && settings.showUnverifiedNotice && (
            <Notice kind="info" title="Pre-launch listing" className="mt-6">
              This price is a planning price. Exact model, specifications, availability and delivery will be confirmed with you before any payment is taken.
            </Notice>
          )}

          <section className="mt-8" aria-labelledby="desc-h">
            <h2 id="desc-h" className="text-lg">Description</h2>
            <p className="mt-2 leading-relaxed text-grey-700">{product.description}</p>
          </section>

          <section className="mt-6" aria-labelledby="spec-h">
            <h2 id="spec-h" className="text-lg">Specifications</h2>
            {product.specifications.length ? (
              <dl className="mt-3 divide-y divide-grey-100 rounded-2xl border border-grey-200">
                {product.specifications.map((s) => (
                  <div key={s.label} className="grid grid-cols-3 gap-4 px-4 py-2.5 text-sm">
                    <dt className="font-medium text-grey-500">{s.label}</dt>
                    <dd className="col-span-2 text-grey-900">{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 flex items-start gap-2 text-sm text-grey-600">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-grey-400" /> Detailed specifications will be published once confirmed with our supplier. Contact us if you need a specific model or feature.
              </p>
            )}
          </section>

          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
            <li className="flex items-start gap-2 rounded-2xl bg-grey-50 p-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" />
              <span>Delivery fee shown or confirmed before payment. <Link href="/shipping-policy" className="font-medium text-burgundy hover:underline">Shipping policy</Link></span>
            </li>
            <li className="flex items-start gap-2 rounded-2xl bg-grey-50 p-3">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" />
              <span><Link href="/returns-policy" className="font-medium text-burgundy hover:underline">Returns & refunds</Link></span>
            </li>
            <li className="flex items-start gap-2 rounded-2xl bg-grey-50 p-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" />
              <span>Questions? <Link href={`/contact?subject=${encodeURIComponent(`Question about ${product.name} (${product.sku})`)}`} className="font-medium text-burgundy hover:underline">Ask us</Link></span>
            </li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related-h">
          <div className="flex items-end justify-between">
            <h2 id="related-h" className="text-2xl">More from {product.category.name}</h2>
            <Link href={`/category/${product.category.slug}`} className="text-sm font-semibold text-burgundy hover:underline">View all →</Link>
          </div>
          <div className="mt-6">
            <ProductGrid products={related} wishlist={wish} signedIn={!!user} />
          </div>
        </section>
      )}
    </div>
  );
}
