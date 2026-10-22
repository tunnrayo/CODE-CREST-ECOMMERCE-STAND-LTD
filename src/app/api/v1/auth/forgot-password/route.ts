import { z } from "zod";
import { clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { requestPasswordReset } from "@/server/services/accounts";

/** POST /api/v1/auth/forgot-password — { email } (always 202; does not reveal whether the account exists) */
export const POST = route(async (req) => {
  if (!rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000).allowed) throw tooMany();
  const { email } = z.object({ email: z.string().email().max(200) }).parse(await readJson(req));
  await requestPasswordReset(email);
  return ok({ accepted: true }, { status: 202 });
});
