import { requireUser } from "@/server/auth/current";
import { ok, route } from "@/server/http";
import { listOrdersForUser } from "@/server/services/orders";

export const dynamic = "force-dynamic";

/** GET /api/v1/account/orders — signed-in customer's order history. */
export const GET = route(async () => {
  const u = await requireUser();
  const orders = await listOrdersForUser(u.id);
  return ok(orders.map(({ accessTokenHash: _h, ...o }) => (void _h, o)));
});
