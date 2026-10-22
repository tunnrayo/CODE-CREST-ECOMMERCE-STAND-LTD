import { z } from "zod";
import { clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { resetPassword } from "@/server/services/accounts";

/** POST /api/v1/auth/reset-password — { token, password } */
export const POST = route(async (req) => {
  if (!rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000).allowed) throw tooMany();
  const { token, password } = z.object({ token: z.string().min(10).max(200), password: z.string().max(200) }).parse(await readJson(req));
  await resetPassword(token, password);
  return ok({ reset: true });
});
