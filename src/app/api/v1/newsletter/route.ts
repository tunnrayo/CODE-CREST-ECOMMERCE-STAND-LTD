import { clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { subscribeNewsletter } from "@/server/services/accounts";

/** POST /api/v1/newsletter — { email, consent: true } */
export const POST = route(async (req) => {
  if (!rateLimit(`newsletter:${clientIp(req)}`, 5, 10 * 60_000).allowed) throw tooMany();
  await subscribeNewsletter((await readJson(req)) as never);
  return ok({ subscribed: true }, { status: 201 });
});
