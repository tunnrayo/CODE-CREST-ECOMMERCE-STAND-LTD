"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Trash2, X, AlertCircle, Info } from "lucide-react";
import clsx from "clsx";
import { formatKobo } from "@/lib/format";
import { useCart, type CartLine } from "./CartProvider";
import { ProductImage } from "../product/ProductImage";

export function CartButton() {
  const { cart, setDrawerOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
      aria-label={`Open cart, ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`}
      data-testid="cart-button"
    >
      <ShoppingBag className="h-6 w-6" aria-hidden />
      {cart.itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1 text-[11px] font-bold text-burgundy-800" data-testid="cart-count">
          {cart.itemCount}
        </span>
      )}
    </button>
  );
}

export function QuantityStepper({ value, onChange, max = 99, disabled, label = "Quantity", size = "md" }: { value: number; onChange: (v: number) => void; max?: number; disabled?: boolean; label?: string; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-8" : "h-11";
  return (
    <div className={clsx("inline-flex items-center rounded-full border border-grey-300 bg-white", h)} role="group" aria-label={label}>
      <button type="button" className={clsx("flex aspect-square items-center justify-center rounded-full text-burgundy hover:bg-grey-100 disabled:opacity-40", h)} onClick={() => onChange(Math.max(1, value - 1))} disabled={disabled || value <= 1} aria-label="Decrease quantity">
        <Minus className="h-4 w-4" />
      </button>
      <input
        className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
        value={value}
        inputMode="numeric"
        aria-label={label}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (n >= 1) onChange(Math.min(max, n));
        }}
      />
      <button type="button" className={clsx("flex aspect-square items-center justify-center rounded-full text-burgundy hover:bg-grey-100 disabled:opacity-40", h)} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AddToCartButton({ productId, variantId = null, quantity = 1, disabled, className, compact, needsOption }: { productId: string; variantId?: string | null; quantity?: number; disabled?: boolean; className?: string; compact?: boolean; needsOption?: boolean }) {
  const { add, toast } = useCart();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={clsx(compact ? "btn-primary btn-sm w-full" : "btn-primary w-full sm:w-auto sm:px-8", className)}
      disabled={disabled || busy}
      data-testid="add-to-cart"
      onClick={async () => {
        if (needsOption) {
          toast("info", "Please choose an option first.");
          return;
        }
        setBusy(true);
        await add(productId, quantity, variantId);
        setBusy(false);
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
      {disabled ? "Unavailable" : "Add to cart"}
    </button>
  );
}

function DrawerLine({ line }: { line: CartLine }) {
  const { update, remove } = useCart();
  return (
    <li className="flex gap-3 py-4">
      <Link href={`/product/${line.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-grey-100">
        <ProductImage src={line.imageUrl} alt={line.imageAlt} sizes="80px" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/product/${line.slug}`} className="line-clamp-2 text-sm font-medium text-grey-900 hover:text-burgundy">
          {line.name}
        </Link>
        {line.variantName && <p className="text-xs text-grey-500">{line.variantName}</p>}
        <p className="mt-0.5 text-sm font-semibold text-burgundy">{formatKobo(line.unitPriceKobo)}</p>
        {line.problem && <p className="mt-1 text-xs font-medium text-red-700">{line.problem}</p>}
        <div className="mt-2 flex items-center gap-2">
          <QuantityStepper size="sm" value={line.quantity} max={Math.max(1, line.maxQuantity)} onChange={(q) => line.itemId && update(line.itemId, q)} />
          <button type="button" onClick={() => line.itemId && remove(line.itemId)} className="ml-auto rounded-full p-2 text-grey-500 hover:bg-grey-100 hover:text-red-700" aria-label={`Remove ${line.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartDrawer() {
  const { cart, drawerOpen, setDrawerOpen } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, setDrawerOpen]);

  return (
    <div className={clsx("fixed inset-0 z-50 overflow-hidden", drawerOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!drawerOpen} inert={!drawerOpen}>
      <div className={clsx("absolute inset-0 bg-grey-900/40 transition-opacity", drawerOpen ? "opacity-100" : "opacity-0")} onClick={() => setDrawerOpen(false)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={clsx("absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300", drawerOpen ? "translate-x-0" : "translate-x-full")}
        data-testid="cart-drawer"
      >
        <div className="flex items-center justify-between bg-burgundy px-5 py-4 text-white">
          <h2 className="text-lg font-semibold text-white">Your cart ({cart.itemCount})</h2>
          <button ref={closeRef} type="button" onClick={() => setDrawerOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Close cart">
            <X className="h-5 w-5" />
          </button>
        </div>
        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-12 w-12 text-grey-300" />
            <p className="font-medium">Your cart is empty</p>
            <Link href="/shop" className="btn-burgundy" onClick={() => setDrawerOpen(false)}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-grey-100 overflow-y-auto px-5">
              {cart.lines.map((l) => (
                <DrawerLine key={l.itemId ?? l.productId} line={l} />
              ))}
            </ul>
            <div className="border-t border-grey-200 p-5">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Subtotal</span>
                <span className="text-burgundy">{formatKobo(cart.subtotalKobo)}</span>
              </div>
              <p className="mt-1 text-xs text-grey-500">Delivery is calculated at checkout.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link href="/cart" className="btn-outline" onClick={() => setDrawerOpen(false)}>
                  View cart
                </Link>
                <Link href="/checkout" className="btn-primary" onClick={() => setDrawerOpen(false)} data-testid="drawer-checkout">
                  Checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useCart();
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={clsx("pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg animate-fade-up", t.kind === "error" ? "bg-red-700 text-white" : t.kind === "success" ? "bg-burgundy text-white" : "bg-grey-900 text-white")} role="status">
          {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : t.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
