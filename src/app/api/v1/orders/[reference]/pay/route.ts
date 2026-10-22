import { z } from "zod";
import { getCurrentUser } from "@/server/auth/current";
import { clientIp, notFound, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { getOrderForViewer } from "@/server/services/orders";
import { initializePayment } from "@/server/services/payments";

/** POST /api/v1/orders/:reference/pay — { token? } → { authorizationUrl } (Paystack) */
export const POST = route<{ reference: string }>(async (req, { params }) => {
  if (!rateLimit(`pay:${clientIp(req)}`, 10, 10 * 60_000).allowed) throw tooMany();
  const { token } = z.object({ token: z.string().max(200).optional().nullable() }).parse(await readJson(req));
  const user = await getCurrentUser();
  const order = await getOrderForViewer(params.reference, { token, userId: user?.id });
  if (!order) throw notFound("Order not found");
  return ok(await initializePayment(order.id, order.email));
});
