import { badRequest, ok, route } from "@/server/http";
import { listProducts } from "@/server/services/catalogue";

export const dynamic = "force-dynamic";

/** GET /api/v1/search?q=… — product search (name, description, keywords, SKU, category). */
export const GET = route(async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  if (!sp.q?.trim()) throw badRequest("Query parameter q is required.");
  const r = await listProducts(sp);
  return ok(r.items, { meta: { total: r.total, page: r.page, perPage: r.perPage, pageCount: r.pageCount, q: r.query.q } });
});
