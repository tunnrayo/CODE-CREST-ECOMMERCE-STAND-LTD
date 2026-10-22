import Link from "next/link";
import { formatKobo } from "@/lib/format";
import type { ProductCard as Card } from "@/server/services/catalogue";
import { AddToCartButton } from "../cart/CartUI";
import { ProductImage } from "./ProductImage";
import { StockBadge, VerificationBadge } from "./Badges";
import { WishlistButton } from "./WishlistButton";

export function Price({ priceKobo, retailPriceKobo, size = "md" }: { priceKobo: number; retailPriceKobo: number; size?: "md" | "lg" }) {
  const onSale = priceKobo < retailPriceKobo;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={size === "lg" ? "text-3xl font-bold text-burgundy" : "text-base font-bold text-burgundy"} data-testid="price">
        {formatKobo(priceKobo)}
      </span>
      {onSale && <s className="text-sm text-grey-400">{formatKobo(retailPriceKobo)}</s>}
    </span>
  );
}

export function ProductCard({ product, wishlisted, signedIn, priority }: { product: Card; wishlisted?: boolean; signedIn?: boolean; priority?: boolean }) {
  const purchasable = product.stockStatus !== "OUT_OF_STOCK";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-grey-200 bg-white transition-shadow hover:shadow-card" data-testid="product-card" data-sku={product.sku}>
      <Link href={`/product/${product.slug}`} className="relative block overflow-hidden bg-grey-100" aria-label={product.name}>
        <span className="block transition-transform duration-300 group-hover:scale-[1.03]">
          <ProductImage src={product.image.url} alt={product.image.alt} priority={priority} />
        </span>
        {product.priceKobo < product.retailPriceKobo && <span className="badge absolute left-3 top-3 bg-lime text-burgundy-800">Sale</span>}
      </Link>
      {signedIn !== undefined && (
        <div className="absolute right-3 top-3">
          <WishlistButton productId={product.id} initial={!!wishlisted} signedIn={!!signedIn} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <Link href={`/category/${product.category.slug}`} className="text-[11px] font-semibold uppercase tracking-wide text-grey-500 hover:text-burgundy">
          {product.category.name}
        </Link>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-grey-900 sm:text-[15px]">
          <Link href={`/product/${product.slug}`} className="hover:text-burgundy">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <Price priceKobo={product.priceKobo} retailPriceKobo={product.retailPriceKobo} />
        </div>
        <div className="flex flex-wrap gap-1">
          <VerificationBadge status={product.verificationStatus} compact />
          <StockBadge status={product.stockStatus} compact />
        </div>
        <div className="pt-2">
          <AddToCartButton productId={product.id} compact disabled={!purchasable} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, wishlist, signedIn }: { products: Card[]; wishlist?: Set<string>; signedIn?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" data-testid="product-grid">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} wishlisted={wishlist?.has(p.id)} signedIn={signedIn} priority={i < 4} />
      ))}
    </div>
  );
}
