import { ok, route } from "@/server/http";
import { listCategories } from "@/server/services/catalogue";

export const dynamic = "force-dynamic";

/** GET /api/v1/categories — active categories with published product counts. */
export const GET = route(async () => ok((await listCategories()).map(({ id, slug, name, description, productCount }) => ({ id, slug, name, description, productCount }))));
