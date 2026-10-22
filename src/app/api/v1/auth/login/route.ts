import { z } from "zod";
import { authenticate } from "@/server/auth/core";
import { startSession } from "@/server/auth/current";
import { ApiError, clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

/** POST /api/v1/auth/login — { email, password } → session cookie (httpOnly). */
export const POST = route(async (req) => {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 10 * 60_000).allowed) throw tooMany();
  const { email, password } = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).parse(await readJson(req));
  const r = await authenticate(email, password);
  if (!r.ok) throw new ApiError(r.reason === "LOCKED" ? 423 : 401, r.reason === "LOCKED" ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS", r.reason === "LOCKED" ? "Too many failed attempts. Try again in 15 minutes." : "Incorrect email or password.");
  await startSession(r.user);
  return ok({ id: r.user.id, email: r.user.email, name: r.user.name, role: r.user.role });
});
