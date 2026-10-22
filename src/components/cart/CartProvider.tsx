"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type CartLine = {
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
  quantity: number;
  lineTotalKobo: number;
  maxQuantity: number;
  verificationStatus: string;
  problem: string | null;
};
export type Cart = { id: string | null; lines: CartLine[]; subtotalKobo: number; itemCount: number; hasProblems: boolean };

type Toast = { id: number; kind: "success" | "error" | "info"; message: string };

type Ctx = {
  cart: Cart;
  loading: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  refresh: () => Promise<void>;
  add: (productId: string, quantity?: number, variantId?: string | null) => Promise<boolean>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  toasts: Toast[];
  toast: (kind: Toast["kind"], message: string) => void;
  dismiss: (id: number) => void;
};

const EMPTY: Cart = { id: null, lines: [], subtotalKobo: 0, itemCount: 0, hasProblems: false };
const CartContext = createContext<Ctx | null>(null);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "same-origin" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  return json.data as T;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((kind: Toast["kind"], message: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    try {
      setCart(await api<Cart>("/api/v1/cart"));
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (productId: string, quantity = 1, variantId: string | null = null) => {
      try {
        const c = await api<Cart>("/api/v1/cart/items", { method: "POST", body: JSON.stringify({ productId, quantity, variantId }) });
        setCart(c);
        setDrawerOpen(true);
        return true;
      } catch (e) {
        toast("error", (e as Error).message);
        await refresh();
        return false;
      }
    },
    [refresh, toast],
  );

  const update = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        setCart(await api<Cart>(`/api/v1/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }));
      } catch (e) {
        toast("error", (e as Error).message);
      }
    },
    [toast],
  );

  const remove = useCallback(
    async (itemId: string) => {
      try {
        setCart(await api<Cart>(`/api/v1/cart/items/${itemId}`, { method: "DELETE" }));
      } catch (e) {
        toast("error", (e as Error).message);
      }
    },
    [toast],
  );

  const value = useMemo(
    () => ({ cart, loading, drawerOpen, setDrawerOpen, refresh, add, update, remove, toasts, toast, dismiss }),
    [cart, loading, drawerOpen, refresh, add, update, remove, toasts, toast, dismiss],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
