import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { cartItems, carts, productVariants, products } from "../db/schema";
import { badRequest, notFound } from "../http";
import { MAX_LINE_QTY, quoteLines } from "./pricing";

export const CART_COOKIE = "cc_cart";
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | null | undefined): s is string => !!s && uuidRe.test(s);

export const addItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(MAX_LINE_QTY).default(1),
});
export const updateItemSchema = z.object({ quantity: z.coerce.number().int().min(0).max(MAX_LINE_QTY) });

/** Resolve the cart for a request: logged-in user's cart, else the anonymous cookie cart. */
export async function resolveCart(cookieCartId: string | undefined, userId: string | null, create = false): Promise<string | null> {
  if (userId) {
    const [own] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).orderBy(asc(carts.createdAt)).limit(1);
    if (own) {
      if (isUuid(cookieCartId) && cookieCartId !== own.id) await mergeCartInto(cookieCartId, own.id);
      return own.id;
    }
    if (isUuid(cookieCartId)) {
      const [anon] = await db.select().from(carts).where(and(eq(carts.id, cookieCartId), isNull(carts.userId))).limit(1);
      if (anon) {
        await db.update(carts).set({ userId }).where(eq(carts.id, anon.id));
        return anon.id;
      }
    }
    if (!create) return null;
    const [c] = await db.insert(carts).values({ userId }).returning({ id: carts.id });
    return c.id;
  }
  if (isUuid(cookieCartId)) {
    const [c] = await db.select().from(carts).where(eq(carts.id, cookieCartId)).limit(1);
    // An anonymous cookie must never unlock a cart that belongs to a user.
    if (c && !c.userId) return c.id;
  }
  if (!create) return null;
  const [c] = await db.insert(carts).values({}).returning({ id: carts.id });
  return c.id;
}

async function mergeCartInto(fromId: string, toId: string) {
  const [from] = await db.select().from(carts).where(and(eq(carts.id, fromId), isNull(carts.userId))).limit(1);
  if (!from) return;
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, fromId));
  for (const it of items) await upsertItem(toId, it.productId, it.variantId, it.quantity);
  await db.delete(carts).where(eq(carts.id, fromId));
}

async function upsertItem(cartId: string, productId: string, variantId: string | null, quantity: number) {
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId), variantId ? eq(cartItems.variantId, variantId) : isNull(cartItems.variantId)))
    .limit(1);
  if (existing) {
    const q = Math.min(MAX_LINE_QTY, existing.quantity + quantity);
    await db.update(cartItems).set({ quantity: q }).where(eq(cartItems.id, existing.id));
    return existing.id;
  }
  const [row] = await db.insert(cartItems).values({ cartId, productId, variantId, quantity: Math.min(MAX_LINE_QTY, quantity) }).returning({ id: cartItems.id });
  return row.id;
}

export async function addToCart(cartId: string, input: z.infer<typeof addItemSchema>) {
  const [p] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  if (!p || p.status !== "PUBLISHED") throw notFound("Product not available");
  const variants = await db.select({ id: productVariants.id, isActive: productVariants.isActive }).from(productVariants).where(eq(productVariants.productId, p.id));
  const activeVariants = variants.filter((v) => v.isActive);
  if (activeVariants.length && !input.variantId) throw badRequest("Please choose an option for this product.");
  if (input.variantId && !activeVariants.some((v) => v.id === input.variantId)) throw badRequest("Invalid product option.");
  if (p.stockStatus === "OUT_OF_STOCK") throw badRequest("This product is out of stock.");

  const itemId = await upsertItem(cartId, p.id, input.variantId ?? null, input.quantity);
  // Validate resulting quantity against stock.
  const view = await getCartView(cartId);
  const line = view.lines.find((l) => l.itemId === itemId);
  if (line?.problem && line.maxQuantity > 0 && line.quantity > line.maxQuantity) {
    await db.update(cartItems).set({ quantity: line.maxQuantity }).where(eq(cartItems.id, itemId));
    throw badRequest(`Only ${line.maxQuantity} available — your cart has been adjusted.`);
  }
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  return getCartView(cartId);
}

export async function updateCartItem(cartId: string, itemId: string, quantity: number) {
  const [it] = await db.select().from(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId))).limit(1);
  if (!it) throw notFound("Cart item not found");
  if (quantity === 0) await db.delete(cartItems).where(eq(cartItems.id, itemId));
  else await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId));
  return getCartView(cartId);
}

export async function removeCartItem(cartId: string, itemId: string) {
  const res = await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId))).returning({ id: cartItems.id });
  if (!res.length) throw notFound("Cart item not found");
  return getCartView(cartId);
}

export async function clearCart(cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

export async function getCartView(cartId: string | null) {
  if (!cartId) return { id: null, lines: [], subtotalKobo: 0, itemCount: 0, hasProblems: false };
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId)).orderBy(asc(cartItems.createdAt));
  const q = await quoteLines(items.map((i) => ({ itemId: i.id, productId: i.productId, variantId: i.variantId, quantity: i.quantity })));
  return { id: cartId, lines: q.lines, subtotalKobo: q.subtotalKobo, itemCount: q.lines.reduce((s, l) => s + l.quantity, 0), hasProblems: q.hasProblems };
}
export type CartView = Awaited<ReturnType<typeof getCartView>>;

export async function cartItemCount(cartId: string | null) {
  if (!cartId) return 0;
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${cartItems.quantity}),0)::int` }).from(cartItems).where(eq(cartItems.cartId, cartId));
  return Number(r?.n ?? 0);
}
