import { startSession } from "@/server/auth/current";
import { clientIp, ok, readJson, route, tooMany } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { registerCustomer } from "@/server/services/accounts";

/** POST /api/v1/auth/register — { name, email, phone?, password } → creates a CUSTOMER and signs in. */
export const POST = route(async (req) => {
  if (!rateLimit(`register:${clientIp(req)}`, 5, 10 * 60_000).allowed) throw tooMany();
  const u = await registerCustomer((await readJson(req)) as never);
  await startSession(u);
  return ok({ id: u.id, email: u.email, name: u.name, role: u.role }, { status: 201 });
});
