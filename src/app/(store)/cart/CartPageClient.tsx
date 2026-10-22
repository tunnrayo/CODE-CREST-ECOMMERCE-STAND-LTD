"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { QuantityStepper } from "@/components/cart/CartUI";
import { ProductImage } from "@/components/product/ProductImage";
import { EmptyState, Notice } from "@/components/ui";
import { formatKobo } from "@/lib/format";

export function CartPageClient() {
  const { cart, loading, update, remove } = useCart();
  if (loading)
    return (
      <div className="container-x flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-burgundy" aria-label="Loading cart" />
      </div>
    );
  if (!cart.lines.length)
    return (
      <div className="container-x py-10">
        <EmptyState title="Your cart is empty" message="Browse the catalogue and add products to your cart." action={<Link href="/shop" className="btn-burgundy">Start shopping</Link>} />
      </div>
    );
  return (
    <div className="container-x grid gap-8 py-8 lg:grid-cols-[1fr_360px]" data-testid="cart-page">
      <div>
        {cart.hasProblems && (
          <Notice kind="warning" title="Some items need attention" className="mb-4">
            Update or remove the highlighted items before checking out.
          </Notice>
        )}
        <ul className="divide-y divide-grey-200 rounded-2xl border border-grey-200 bg-white">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex gap-4 p-4" data-testid="cart-line">
              <Link href={`/product/${l.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-grey-100">
                <ProductImage src={l.imageUrl} alt={l.imageAlt} sizes="96px" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${l.slug}`} className="font-medium hover:text-burgundy">{l.name}</Link>
                  {l.variantName && <p className="text-xs text-grey-500">{l.variantName}</p>}
                  <p className="text-xs text-grey-500">SKU {l.sku} · {formatKobo(l.unitPriceKobo)} each</p>
                  {l.problem && <p className="mt-1 text-xs font-semibold text-red-700">{l.problem}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <QuantityStepper size="sm" value={l.quantity} max={Math.max(1, l.maxQuantity)} onChange={(q) => l.itemId && update(l.itemId, q)} label={`Quantity for ${l.name}`} />
                  <span className="w-24 text-right font-semibold text-burgundy" data-testid="line-total">{formatKobo(l.lineTotalKobo)}</span>
                  <button type="button" onClick={() => l.itemId && remove(l.itemId)} className="rounded-full p-2 text-grey-500 hover:bg-grey-100 hover:text-red-700" aria-label={`Remove ${l.name}`} data-testid="remove-line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/shop" className="mt-4 inline-block text-sm font-semibold text-burgundy hover:underline">← Continue shopping</Link>
      </div>
      <aside className="card h-fit p-6 lg:sticky lg:top-40">
        <h2 className="text-lg">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Items ({cart.itemCount})</dt><dd data-testid="cart-subtotal">{formatKobo(cart.subtotalKobo)}</dd></div>
          <div className="flex justify-between text-grey-500"><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
        </dl>
        <div className="mt-4 flex justify-between border-t border-grey-200 pt-4 text-base font-semibold">
          <span>Subtotal</span>
          <span className="text-burgundy">{formatKobo(cart.subtotalKobo)}</span>
        </div>
        {cart.hasProblems ? (
          <button className="btn-primary mt-6 w-full" disabled>Proceed to checkout</button>
        ) : (
          <Link href="/checkout" className="btn-primary mt-6 w-full" data-testid="checkout-link">Proceed to checkout</Link>
        )}
        <p className="mt-3 text-center text-xs text-grey-500">Prices are confirmed by our server at checkout.</p>
      </aside>
    </div>
  );
}
