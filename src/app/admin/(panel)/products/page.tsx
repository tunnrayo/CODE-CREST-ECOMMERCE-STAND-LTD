import Link from "next/link";
import Image from "next/image";
import { Download, Plus, Upload } from "lucide-react";
import { AdminPage, Back, Panel, type SP } from "@/components/admin/AdminUI";
import { Pagination, StatusPill } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { adminListProducts } from "@/server/services/admin-catalogue";
import { listCategories } from "@/server/services/catalogue";
import { formatKobo } from "@/lib/format";
import { bulkStatusAction, importCsvAction } from "../../actions";

export const metadata = { title: "Products" };

export default async function ProductsAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("catalogue:write");
  const sp = await searchParams;
  const filters = { q: sp.q || undefined, category: sp.category || undefined, status: (sp.status || undefined) as never, verification: (sp.verification || undefined) as never, stock: (sp.stock || undefined) as never, page: Number(sp.page) || 1 };
  const [res, cats] = await Promise.all([adminListProducts(filters), listCategories({ includeInactive: true })]);
  const qs = (page: number) => {
    const p = new URLSearchParams(Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]);
    return `/admin/products?${p}`;
  };
  const backUrl = qs(res.page);
  return (
    <AdminPage
      title="Products"
      subtitle={`${res.total} matching products`}
      searchParams={sp}
      actions={
        <>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download endpoint, not a page */}
          <a href="/api/v1/admin/products/export" className="btn-outline btn-sm"><Download className="h-3.5 w-3.5" /> Export CSV</a>
          <Link href="/admin/products/new" className="btn-burgundy btn-sm"><Plus className="h-3.5 w-3.5" /> New product</Link>
        </>
      }
    >
      <Panel>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <input name="q" defaultValue={filters.q} placeholder="Search name, SKU, keyword" className="input lg:col-span-2" aria-label="Search products" />
          <select name="category" defaultValue={filters.category ?? ""} className="input" aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select name="status" defaultValue={filters.status ?? ""} className="input" aria-label="Status">
            <option value="">Any status</option><option>PUBLISHED</option><option>DRAFT</option><option>ARCHIVED</option>
          </select>
          <select name="verification" defaultValue={filters.verification ?? ""} className="input" aria-label="Verification">
            <option value="">Any verification</option><option value="UNVERIFIED">Unverified</option><option value="SUPPLIER_VERIFIED">Supplier verified</option>
          </select>
          <button className="btn-burgundy">Filter</button>
        </form>
      </Panel>

      <form action={bulkStatusAction}>
        <Back href={backUrl} />
        <Panel
          title="Catalogue"
          actions={
            <div className="flex items-center gap-2">
              <select name="bulkStatus" className="input py-1.5 text-xs" defaultValue="" aria-label="Bulk action">
                <option value="" disabled>Bulk action…</option>
                <option value="PUBLISHED">Publish</option>
                <option value="DRAFT">Unpublish (draft)</option>
                <option value="ARCHIVED">Archive</option>
              </select>
              <button className="btn-outline btn-sm">Apply to selected</button>
            </div>
          }
        >
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="table-admin" data-testid="admin-products-table">
              <thead>
                <tr><th className="w-8"><span className="sr-only">Select</span></th><th>Product</th><th>SKU</th><th>Category</th><th className="text-right">Planning</th><th className="text-right">Retail</th><th>Status</th><th>Verification</th><th>Images</th></tr>
              </thead>
              <tbody>
                {res.items.map(({ p, categoryName, imageUrl, imageCount }) => (
                  <tr key={p.id} className="hover:bg-grey-50">
                    <td><input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.name}`} className="accent-burgundy" /></td>
                    <td>
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium hover:text-burgundy">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-grey-100">{imageUrl && <Image src={imageUrl} alt="" fill sizes="40px" className="object-cover" />}</span>
                        <span className="max-w-[260px]">{p.name}{p.isFeatured && <span className="badge ml-2 bg-lime-100 text-lime-800">featured</span>}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs">{p.sku}</td>
                    <td className="whitespace-nowrap">{categoryName}</td>
                    <td className="whitespace-nowrap text-right text-grey-500">{formatKobo(p.basePlanningPriceKobo)}</td>
                    <td className="whitespace-nowrap text-right font-semibold">{formatKobo(p.retailPriceKobo)}{p.salePriceKobo != null && <span className="block text-xs text-lime-700">sale {formatKobo(p.salePriceKobo)}</span>}</td>
                    <td><StatusPill status={p.status} /></td>
                    <td>{p.verificationStatus === "SUPPLIER_VERIFIED" ? <span className="badge bg-lime-100 text-lime-800">verified</span> : <span className="badge bg-amber-50 text-amber-800">unverified</span>}</td>
                    <td className="text-center">{imageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </form>
      <Pagination page={res.page} pageCount={res.pageCount} makeHref={qs} />

      <Panel title="Import price & status updates (CSV)">
        <form action={importCsvAction} className="flex flex-wrap items-end gap-3">
          <Back href="/admin/products" />
          <div>
            <label htmlFor="csv" className="label">CSV file</label>
            <input id="csv" type="file" name="file" accept=".csv,text/csv" className="text-sm" required />
          </div>
          <button className="btn-outline btn-sm"><Upload className="h-3.5 w-3.5" /> Import</button>
          <p className="w-full text-xs text-grey-500">Use the exported CSV as a template. Rows are matched by SKU; only existing products are updated (name, description, status, verification, retail and sale price). Every change is audit-logged.</p>
        </form>
      </Panel>
    </AdminPage>
  );
}
