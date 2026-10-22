import { requireUser } from "@/server/auth/current";
import { ok, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/auth/me — the signed-in user (401 otherwise). */
export const GET = route(async () => {
  const u = await requireUser();
  return ok({ id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone });
});
