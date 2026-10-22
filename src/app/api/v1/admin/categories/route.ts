import { ok, readJson, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { categorySchema, createCategory } from "@/server/services/admin-catalogue";
import { listCategories } from "@/server/services/catalogue";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requirePermission("admin:access");
  return ok(await listCategories({ includeInactive: true }));
});

export const POST = route(async (req) => {
  const user = await requirePermission("catalogue:write");
  return ok(await createCategory(categorySchema.parse(await readJson(req)), user), { status: 201 });
});
