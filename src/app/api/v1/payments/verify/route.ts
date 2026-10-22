import { z } from "zod";
import { clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { verifyPayment } from "@/server/services/payments";

/** POST /api/v1/payments/verify — { reference } → server-side verification with Paystack */
export const POST = route(async (req) => {
  if (!rateLimit(`verify:${clientIp(req)}`, 20, 10 * 60_000).allowed) throw tooMany();
  const { reference } = z.object({ reference: z.string().trim().min(5).max(80) }).parse(await readJson(req));
  const r = await verifyPayment(reference, "callback");
  return ok({ status: r.status });
});
