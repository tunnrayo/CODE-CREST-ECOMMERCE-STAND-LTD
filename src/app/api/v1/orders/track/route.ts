import { z } from "zod";
import { clientIp, notFound, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { trackOrder } from "@/server/services/orders";

/** POST /api/v1/orders/track — { reference, email } → limited order status view */
export const POST = route(async (req) => {
  if (!rateLimit(`track:${clientIp(req)}`, 20, 10 * 60_000).allowed) throw tooMany();
  const { reference, email } = z.object({ reference: z.string().trim().min(5).max(40), email: z.string().trim().email() }).parse(await readJson(req));
  const r = await trackOrder(reference, email);
  if (!r) throw notFound("We couldn't find an order with that reference and email.");
  return ok(r);
});
