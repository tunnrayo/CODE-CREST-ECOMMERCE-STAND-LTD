"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import clsx from "clsx";
import { formatKobo } from "@/lib/format";
import { AddToCartButton, QuantityStepper } from "../cart/CartUI";

type Variant = { id: string; name: string; options: Record<string, string>; priceOverrideKobo: number | null; isActive: boolean; trackInventory: boolean; stockQuantity: number | null };

export function PurchasePanel({ productId, priceKobo, retailPriceKobo, variants, outOfStock, maxQty }: { productId: string; priceKobo: number; retailPriceKobo: number; variants: Variant[]; outOfStock: boolean; maxQty: number }) {
  const active = variants.filter((v) => v.isActive);
  const [variantId, setVariantId] = useState<string | null>(active.length === 1 ? active[0].id : null);
  const [qty, setQty] = useState(1);
  const [copied, setCopied] = useState(false);
  const variant = active.find((v) => v.id === variantId) ?? null;
  const unit = variant?.priceOverrideKobo ?? priceKobo;
  const variantOut = !!variant && variant.trackInventory && variant.stockQuantity != null && variant.stockQuantity <= 0;
  const limit = useMemo(() => (variant?.trackInventory && variant.stockQuantity != null ? Math.max(1, Math.min(99, variant.stockQuantity)) : maxQty), [variant, maxQty]);

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-burgundy" data-testid="pdp-price">{formatKobo(unit)}</span>
        {!variant?.priceOverrideKobo && priceKobo < retailPriceKobo && <s className="text-lg text-grey-400">{formatKobo(retailPriceKobo)}</s>}
      </div>

      {active.length > 0 && (
        <fieldset>
          <legend className="label">Choose an option</legend>
          <div className="flex flex-wrap gap-2">
            {active.map((v) => {
              const out = v.trackInventory && v.stockQuantity != null && v.stockQuantity <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={variantId === v.id}
                  disabled={out}
                  onClick={() => setVariantId(v.id)}
                  className={clsx("rounded-full border px-4 py-2 text-sm font-medium transition", variantId === v.id ? "border-burgundy bg-burgundy text-white" : "border-grey-300 hover:border-burgundy", out && "cursor-not-allowed opacity-40 line-through")}
                >
                  {v.name}
                  {v.priceOverrideKobo != null && <span className="ml-1 opacity-75">· {formatKobo(v.priceOverrideKobo)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <QuantityStepper value={qty} onChange={setQty} max={limit} disabled={outOfStock || variantOut} />
        <AddToCartButton productId={productId} variantId={variantId} quantity={qty} disabled={outOfStock || variantOut} needsOption={active.length > 0 && !variantId} />
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm font-medium text-grey-600 hover:text-burgundy"
        onClick={async () => {
          const url = window.location.href;
          try {
            if (navigator.share) await navigator.share({ url, title: document.title });
            else {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          } catch {
            /* user cancelled */
          }
        }}
      >
        {copied ? <Check className="h-4 w-4 text-lime-700" /> : typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Link copied" : "Share this product"}
      </button>
    </div>
  );
}
