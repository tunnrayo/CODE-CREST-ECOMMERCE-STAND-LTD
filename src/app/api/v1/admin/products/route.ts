import { ok, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { adminListProducts, createProduct, productInputSchema } from "@/server/services/admin-catalogue";
import { readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requirePermission("admin:access");
  const r = await adminListProducts(Object.fromEntries(req.nextUrl.searchParams));
  return ok(r.items, { meta: { total: r.total, page: r.page, perPage: r.perPage, pageCount: r.pageCount } });
});

export const POST = route(async (req) => {
  const user = await requirePermission("catalogue:write");
  const input = productInputSchema.parse(await readJson(req));
  const p = await createProduct(input, user);
  return ok(p, { status: 201 });
});
