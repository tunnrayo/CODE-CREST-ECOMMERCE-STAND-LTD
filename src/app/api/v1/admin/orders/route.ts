import { ok, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { adminListOrders } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requirePermission("orders:read");
  const r = await adminListOrders(Object.fromEntries(req.nextUrl.searchParams));
  return ok(r.items, { meta: { total: r.total, page: r.page, perPage: r.perPage, pageCount: r.pageCount } });
});
