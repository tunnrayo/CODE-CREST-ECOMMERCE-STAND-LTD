import { currentCartId } from "@/server/cart-context";
import { notFound, ok, readJson, route } from "@/server/http";
import { isUuid, removeCartItem, updateCartItem, updateItemSchema } from "@/server/services/cart";

type P = { itemId: string };

/** PATCH /api/v1/cart/items/:itemId — set quantity (0 removes). */
export const PATCH = route<P>(async (req, { params }) => {
  if (!isUuid(params.itemId)) throw notFound("Cart item not found");
  const { quantity } = updateItemSchema.parse(await readJson(req));
  const cartId = await currentCartId(false);
  if (!cartId) throw notFound("Cart not found");
  return ok(await updateCartItem(cartId, params.itemId, quantity));
});

/** DELETE /api/v1/cart/items/:itemId */
export const DELETE = route<P>(async (_req, { params }) => {
  if (!isUuid(params.itemId)) throw notFound("Cart item not found");
  const cartId = await currentCartId(false);
  if (!cartId) throw notFound("Cart not found");
  return ok(await removeCartItem(cartId, params.itemId));
});
