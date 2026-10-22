import { ok, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { inventoryOverview } from "@/server/services/admin-catalogue";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requirePermission("admin:access");
  const inv = await inventoryOverview();
  return ok({ trackedCount: inv.trackedCount, untrackedCount: inv.untrackedCount, lowStock: inv.lowStock.map((r) => r.p.sku), outOfStock: inv.outOfStock.map((r) => r.p.sku) });
});
