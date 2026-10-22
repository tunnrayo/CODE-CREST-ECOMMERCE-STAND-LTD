import { ok, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { getImageReport } from "@/server/services/admin-catalogue";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requirePermission("admin:access");
  const r = await getImageReport();
  return ok(r.rows.map((x) => ({ sku: x.sku, name: x.name, image: x.image ? { url: x.image.url, sourceType: x.image.sourceType, sourceName: x.image.sourceName, licenseStatus: x.image.licenseStatus, verificationStatus: x.image.verificationStatus } : null })), { meta: r.summary });
});
