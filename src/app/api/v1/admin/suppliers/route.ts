import { ok, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { listSuppliers } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requirePermission("suppliers:read");
  return ok(await listSuppliers());
});
