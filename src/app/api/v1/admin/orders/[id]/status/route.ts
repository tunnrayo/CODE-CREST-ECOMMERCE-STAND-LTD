import { ok, readJson, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { statusUpdateSchema, updateOrderStatus } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission("orders:write");
  const input = statusUpdateSchema.parse(await readJson(req));
  return ok(await updateOrderStatus(params.id, input, user));
});
