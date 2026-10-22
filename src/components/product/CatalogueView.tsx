import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { EmptyState, Pagination } from "@/components/ui";
import { ProductGrid } from "./ProductCard";
import { SortSelect } from "./SortSelect";
import { listCategories, listProducts, type ListQuery } from "@/server/services/catalogue";
import { getCurrentUser } from "@/server/auth/current";
import { wishlistFor } from "@/server/services/accounts";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseCatalogueParams(sp: SP, fixed: Partial<ListQuery> = {}) {
  const raw = {
    q: one(sp.q),
    category: one(sp.category),
    minPrice: one(sp.minPrice) || undefined,
    maxPrice: one(sp.maxPrice) || undefined,
    sort: one(sp.sort) || undefined,
    page: one(sp.page) || undefined,
  };
  return { ...raw, ...fixed };
}

export async function CatalogueView({ basePath, searchParams, fixedCategory, showCategoryFilter = true }: { basePath: string; searchParams: SP; fixedCategory?: string; showCategoryFilter?: boolean }) {
  const input = parseCatalogueParams(searchParams, fixedCategory ? { category: fixedCategory } : {});
  let result: Awaited<ReturnType<typeof listProducts>>;
  try {
    result = await listProducts(input as Partial<ListQuery>);
  } catch {
    // Invalid filter values → fall back to defaults rather than erroring.
    result = await listProducts(fixedCategory ? { category: fixedCategory } : {});
  }
  const [categories, user] = await Promise.all([listCategories(), getCurrentUser()]);
  const wish = user ? new Set((await wishlistFor(user.id)).map((w) => w.productId)) : undefined;
  const q = result.query;

  const href = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = { q: q.q, category: fixedCategory ? undefined : q.category, minPrice: q.minPrice, maxPrice: q.maxPrice, sort: q.sort === "featured" ? undefined : q.sort, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  const filtersActive = !!(q.minPrice != null || q.maxPrice != null || (!fixedCategory && q.category));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.total, result.page * result.perPage);

  return (
    <div className="container-x grid gap-8 py-8 lg:grid-cols-[250px_1fr]">
      <aside aria-label="Filters">
        <details className="group rounded-2xl border border-grey-200 bg-white p-4 lg:sticky lg:top-40 lg:block" open>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold lg:cursor-default">
            <SlidersHorizontal className="h-4 w-4 text-burgundy" /> Filters
          </summary>
          <form action={basePath} method="get" className="mt-4 space-y-5" data-testid="filter-form">
            {q.q && <input type="hidden" name="q" value={q.q} />}
            {q.sort !== "featured" && <input type="hidden" name="sort" value={q.sort} />}
            {showCategoryFilter && !fixedCategory && (
              <fieldset>
                <legend className="label">Category</legend>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="category" value="" defaultChecked={!q.category} className="accent-burgundy" /> All categories
                  </label>
                  {categories.map((c) => (
                    <label key={c.slug} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="category" value={c.slug} defaultChecked={q.category === c.slug} className="accent-burgundy" />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-xs text-grey-400">{c.productCount}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {fixedCategory && (
              <div>
                <p className="label">Other categories</p>
                <ul className="space-y-1 text-sm">
                  {categories.filter((c) => c.slug !== fixedCategory).map((c) => (
                    <li key={c.slug}><Link className="text-grey-700 hover:text-burgundy" href={`/category/${c.slug}`}>{c.name}</Link></li>
                  ))}
                </ul>
              </div>
            )}
            <fieldset>
              <legend className="label">Price (₦)</legend>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="minPrice">Minimum price</label>
                <input id="minPrice" name="minPrice" type="number" min={0} step={500} placeholder="Min" defaultValue={q.minPrice ?? ""} className="input" />
                <span className="text-grey-400">–</span>
                <label className="sr-only" htmlFor="maxPrice">Maximum price</label>
                <input id="maxPrice" name="maxPrice" type="number" min={0} step={500} placeholder="Max" defaultValue={q.maxPrice ?? ""} className="input" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {[
                  [undefined, 10000, "Under ₦10k"],
                  [10000, 20000, "₦10k–₦20k"],
                  [20000, 40000, "₦20k–₦40k"],
                  [40000, undefined, "₦40k+"],
                ].map(([min, max, label]) => (
                  <Link key={String(label)} href={href({ minPrice: min as number | undefined, maxPrice: max as number | undefined, page: 1 })} className="rounded-full border border-grey-200 px-2.5 py-1 hover:border-burgundy hover:text-burgundy">
                    {label}
                  </Link>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <button className="btn-burgundy flex-1">Apply</button>
              {filtersActive && (
                <Link href={href({ category: undefined, minPrice: undefined, maxPrice: undefined, page: 1 })} className="btn-ghost">
                  Clear
                </Link>
              )}
            </div>
          </form>
        </details>
      </aside>
      <section aria-label="Products">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-grey-600" data-testid="result-count" aria-live="polite">
            {result.total === 0 ? "No products found" : `Showing ${from}–${to} of ${result.total} product${result.total === 1 ? "" : "s"}`}
            {q.q && (
              <>
                {" "}for <strong className="text-grey-900">“{q.q}”</strong>
              </>
            )}
          </p>
          <SortSelect value={q.sort} />
        </div>
        {result.items.length ? (
          <ProductGrid products={result.items} wishlist={wish} signedIn={!!user} />
        ) : (
          <EmptyState
            title={q.q ? `No results for “${q.q}”` : "No products match these filters"}
            message="Try a different search term, remove some filters or browse our categories."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/shop" className="btn-burgundy">Shop all products</Link>
                <Link href="/categories" className="btn-outline">Browse categories</Link>
              </div>
            }
          />
        )}
        <Pagination page={result.page} pageCount={result.pageCount} makeHref={(p) => href({ page: p })} />
      </section>
    </div>
  );
}
