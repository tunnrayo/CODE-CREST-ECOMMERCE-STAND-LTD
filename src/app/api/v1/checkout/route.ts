import { getCurrentUser } from "@/server/auth/current";
import { currentCartId } from "@/server/cart-context";
import { badRequest, clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { checkoutSchema, createOrderFromCart } from "@/server/services/orders";
import { initializePayment, paymentsConfigured } from "@/server/services/payments";

/**
 * POST /api/v1/checkout — place an order from the current cart.
 * Totals are recalculated server-side. In LIVE mode a Paystack payment is
 * initialised and its authorization URL returned.
 */
export const POST = route(async (req) => {
  if (!rateLimit(`checkout:${clientIp(req)}`, 10, 10 * 60_000).allowed) throw tooMany();
  const input = checkoutSchema.parse(await readJson(req));
  const cartId = await currentCartId(false);
  if (!cartId) throw badRequest("Your cart is empty.");
  const user = await getCurrentUser();
  const order = await createOrderFromCart(cartId, user?.id ?? null, input);
  let payment: { authorizationUrl: string; reference: string } | null = null;
  if (order.mode === "LIVE" && paymentsConfigured() && order.shippingConfirmed) {
    payment = await initializePayment(order.id, input.email);
  }
  return ok({ reference: order.reference, accessToken: order.accessToken, totalKobo: order.totalKobo, mode: order.mode, payment }, { status: 201 });
});
