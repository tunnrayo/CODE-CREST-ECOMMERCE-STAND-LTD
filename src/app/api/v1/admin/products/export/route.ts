import { route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { exportProductsCsv } from "@/server/services/admin-catalogue";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requirePermission("admin:access");
  const csv = await exportProductsCsv();
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="code-crest-products.csv"', "cache-control": "no-store" } });
});
