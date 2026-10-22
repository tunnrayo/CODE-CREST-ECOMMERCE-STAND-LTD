import { ok, route } from "@/server/http";
import { listProducts } from "@/server/services/catalogue";

export const dynamic = "force-dynamic";

/** GET /api/v1/products?q=&category=&minPrice=&maxPrice=&sort=&page=&perPage=&featured= (prices in naira for filters; responses in kobo) */
export const GET = route(async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const r = await listProducts(sp);
  return ok(r.items, { meta: { total: r.total, page: r.page, perPage: r.perPage, pageCount: r.pageCount } });
});
