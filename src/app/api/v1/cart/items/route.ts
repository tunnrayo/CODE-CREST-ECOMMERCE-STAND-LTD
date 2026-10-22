import { currentCartId } from "@/server/cart-context";
import { clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { addItemSchema, addToCart } from "@/server/services/cart";

/** POST /api/v1/cart/items — add a product (prices are never accepted from the client). */
export const POST = route(async (req) => {
  if (!rateLimit(`cart:${clientIp(req)}`, 120, 60_000).allowed) throw tooMany();
  const body = addItemSchema.parse(await readJson(req));
  const cartId = (await currentCartId(true))!;
  return ok(await addToCart(cartId, body), { status: 201 });
});
