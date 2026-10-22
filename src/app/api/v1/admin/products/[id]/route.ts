import { notFound, ok, readJson, route } from "@/server/http";
import { requirePermission } from "@/server/auth/current";
import { productInputSchema, updateProduct } from "@/server/services/admin-catalogue";
import { getProductById } from "@/server/services/catalogue";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requirePermission("admin:access");
  const p = await getProductById(params.id);
  if (!p) throw notFound("Product not found");
  return ok(p);
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission("catalogue:write");
  const input = productInputSchema.parse(await readJson(req));
  return ok(await updateProduct(params.id, input, user));
});
