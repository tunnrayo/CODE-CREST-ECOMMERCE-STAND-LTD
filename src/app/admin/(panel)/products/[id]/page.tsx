import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ExternalLink, Star, Trash2 } from "lucide-react";
import { AdminPage, Back, Check, Panel, Select, TextField, koboToInput, type SP } from "@/components/admin/AdminUI";
import { ProductForm } from "@/components/admin/ProductForm";
import { SubmitButton } from "@/components/forms/ActionForm";
import { StatusPill } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { getProductById, listCategories } from "@/server/services/catalogue";
import { calculateMargin, listSuppliers, supplierRefsForProduct } from "@/server/services/suppliers";
import { recentMovements } from "@/server/services/admin-catalogue";
import { formatDate, formatKobo } from "@/lib/format";
import {
  addVariantAction,
  adjustStockAction,
  deleteImageAction,
  deleteVariantAction,
  primaryImageAction,
  supplierProductAction,
  toggleVariantAction,
  untrackStockAction,
  updateImageAction,
  updateProductAction,
  uploadImageAction,
} from "../../../actions";

export const metadata = { title: "Edit product" };

const SOURCE_TYPES: [string, string][] = [["ORIGINAL_ILLUSTRATION", "Code Crest illustration"], ["MANUFACTURER", "Manufacturer"], ["SUPPLIER", "Supplier"], ["STOCK_LICENSED", "Licensed stock"], ["ADMIN_UPLOAD", "Own photo (admin upload)"], ["PLACEHOLDER", "Placeholder"]];
const LICENSES: [string, string][] = [["OWNED", "Owned by Code Crest"], ["PERMITTED", "Written permission"], ["LICENSED", "Licensed"], ["PENDING_PERMISSION", "Permission pending"], ["UNKNOWN", "Unknown"]];
const VERIF: [string, string][] = [["PENDING", "Pending check"], ["VERIFIED", "Verified for use"], ["NEEDS_REPLACEMENT", "Needs replacement"]];

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requireAdminPage("catalogue:write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const product = await getProductById(id);
  if (!product) notFound();
  const [cats, refs, suppliers, moves] = await Promise.all([listCategories({ includeInactive: true }), supplierRefsForProduct(id), listSuppliers(), recentMovements(id, 10)]);
  const here = `/admin/products/${id}`;
  const realImages = product.images.filter((i) => i.id !== "fallback");
  const primaryRef = refs.find((r) => r.ref.isPrimary) ?? refs[0];
  const margin = calculateMargin(product.salePriceKobo ?? product.retailPriceKobo, primaryRef?.ref);

  return (
    <AdminPage
      title={product.name}
      subtitle={`${product.sku} · ${product.category.name}`}
      searchParams={sp}
      actions={
        <>
          <Link href="/admin/products" className="btn-ghost btn-sm">← Products</Link>
          {product.status === "PUBLISHED" && <Link href={`/product/${product.slug}`} target="_blank" className="btn-outline btn-sm"><ExternalLink className="h-3.5 w-3.5" /> View on store</Link>}
        </>
      }
    >
      <div className="flex flex-wrap gap-2"><StatusPill status={product.status} />{product.verificationStatus === "SUPPLIER_VERIFIED" ? <span className="badge bg-lime-100 text-lime-800">supplier verified</span> : <span className="badge bg-amber-50 text-amber-800">unverified planning data</span>}</div>

      <ProductForm action={updateProductAction} product={product} categories={cats} backHref={here} />

      <Panel title={`Images (${realImages.length})`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {realImages.map((img) => (
            <div key={img.id} className="rounded-2xl border border-grey-200 p-4">
              <div className="flex gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-grey-100"><Image src={img.url} alt={img.altText} fill sizes="112px" className="object-cover" /></div>
                <div className="min-w-0 flex-1 space-y-1 text-xs">
                  {img.isPrimary && <span className="badge bg-burgundy text-white">primary</span>}
                  <p className="break-all text-grey-500">{img.url}</p>
                  <p>Source: <strong>{img.sourceName ?? "—"}</strong></p>
                  {img.sourcePageUrl && <p className="break-all">Page: <a href={img.sourcePageUrl} target="_blank" rel="noopener noreferrer" className="text-burgundy underline">{img.sourcePageUrl}</a></p>}
                  <div className="flex flex-wrap gap-1"><StatusPill status={img.licenseStatus} /><StatusPill status={img.verificationStatus} /></div>
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-burgundy">Edit image details</summary>
                <form action={updateImageAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Back href={here} />
                  <input type="hidden" name="imageId" value={img.id} />
                  <div className="sm:col-span-2"><TextField name="altText" id={`alt-${img.id}`} label="Alt text" defaultValue={img.altText} required /></div>
                  <Select name="sourceType" id={`st-${img.id}`} label="Source type" options={SOURCE_TYPES} defaultValue={img.sourceType} />
                  <TextField name="sourceName" id={`sn-${img.id}`} label="Source / supplier name" defaultValue={img.sourceName} />
                  <div className="sm:col-span-2"><TextField name="sourcePageUrl" id={`su-${img.id}`} label="Original source page URL" defaultValue={img.sourcePageUrl} type="url" /></div>
                  <Select name="licenseStatus" id={`ls-${img.id}`} label="Usage permission" options={LICENSES} defaultValue={img.licenseStatus} />
                  <Select name="verificationStatus" id={`vs-${img.id}`} label="Verification" options={VERIF} defaultValue={img.verificationStatus} />
                  <div className="sm:col-span-2"><TextField name="notes" id={`n-${img.id}`} label="Notes" defaultValue={img.notes} /></div>
                  <SubmitButton className="btn-burgundy btn-sm">Save details</SubmitButton>
                </form>
              </details>
              <div className="mt-3 flex gap-2">
                {!img.isPrimary && (
                  <form action={primaryImageAction}><Back href={here} /><input type="hidden" name="imageId" value={img.id} /><button className="btn-outline btn-sm"><Star className="h-3.5 w-3.5" /> Make primary</button></form>
                )}
                <form action={deleteImageAction}><Back href={here} /><input type="hidden" name="imageId" value={img.id} /><button className="btn-danger btn-sm"><Trash2 className="h-3.5 w-3.5" /> Delete</button></form>
              </div>
            </div>
          ))}
        </div>
        <form action={uploadImageAction} className="mt-6 grid gap-3 rounded-2xl bg-grey-50 p-4 sm:grid-cols-2 lg:grid-cols-3" encType="multipart/form-data" data-testid="image-upload-form">
          <Back href={here} />
          <input type="hidden" name="productId" value={id} />
          <div className="sm:col-span-2 lg:col-span-3"><h3 className="text-sm font-semibold">Upload a new image</h3><p className="text-xs text-grey-500">JPEG, PNG or WebP · max 5 MB · min 200×200. Images are re-encoded to WebP and padded to a square. Record where the image came from and whether you have permission to use it.</p></div>
          <div><label htmlFor="up-file" className="label">File</label><input id="up-file" type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" /></div>
          <TextField name="altText" id="up-alt" label="Alt text" defaultValue={`${product.name}`} required />
          <Select name="sourceType" id="up-st" label="Source type" options={SOURCE_TYPES} defaultValue="SUPPLIER" />
          <TextField name="sourceName" id="up-sn" label="Source / supplier name" />
          <TextField name="sourcePageUrl" id="up-su" label="Source page URL" type="url" />
          <Select name="licenseStatus" id="up-ls" label="Usage permission" options={LICENSES} defaultValue="PENDING_PERMISSION" />
          <Select name="verificationStatus" id="up-vs" label="Verification" options={VERIF} defaultValue="PENDING" />
          <div className="flex items-end"><Check name="makePrimary" label="Make primary image" defaultChecked /></div>
          <div className="flex items-end"><SubmitButton className="btn-burgundy btn-sm">Upload image</SubmitButton></div>
        </form>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Variants">
          {product.variants.length === 0 && <p className="text-sm text-grey-600">No variants. Add options such as colour or size only when they are confirmed with the supplier.</p>}
          <ul className="space-y-3">
            {product.variants.map((v) => (
              <li key={v.id} className="rounded-xl border border-grey-200 p-3">
                <form action={toggleVariantAction} className="grid gap-2 sm:grid-cols-4">
                  <Back href={here} />
                  <input type="hidden" name="productId" value={id} />
                  <input type="hidden" name="variantId" value={v.id} />
                  <input type="hidden" name="options" value={JSON.stringify(v.options)} />
                  <input type="hidden" name="position" value={v.position} />
                  <TextField name="name" id={`vn-${v.id}`} label="Name" defaultValue={v.name} required />
                  <TextField name="sku" id={`vk-${v.id}`} label="SKU" defaultValue={v.sku} required />
                  <TextField name="priceOverride" id={`vp-${v.id}`} label="Price override ₦" defaultValue={koboToInput(v.priceOverrideKobo)} />
                  <TextField name="stockQuantity" id={`vq-${v.id}`} label="Stock qty" type="number" min={0} defaultValue={v.stockQuantity ?? ""} />
                  <Check name="trackInventory" label="Track stock" defaultChecked={v.trackInventory} />
                  <Check name="isActive" label="Active" defaultChecked={v.isActive} />
                  <div className="sm:col-span-2 flex gap-2"><SubmitButton className="btn-outline btn-sm">Save</SubmitButton></div>
                </form>
                <form action={deleteVariantAction} className="mt-2"><Back href={here} /><input type="hidden" name="productId" value={id} /><input type="hidden" name="variantId" value={v.id} /><button className="text-xs font-semibold text-red-700 hover:underline">Delete variant</button></form>
              </li>
            ))}
          </ul>
          <form action={addVariantAction} className="mt-4 grid gap-3 rounded-xl bg-grey-50 p-3 sm:grid-cols-2">
            <Back href={here} />
            <input type="hidden" name="productId" value={id} />
            <TextField name="name" id="nv-name" label="Variant name" placeholder="e.g. Black" required />
            <TextField name="sku" id="nv-sku" label="Variant SKU" defaultValue={`${product.sku}-`} required />
            <TextField name="options" id="nv-opt" label="Options" placeholder="Colour=Black, Size=M" />
            <TextField name="priceOverride" id="nv-price" label="Price override ₦ (optional)" />
            <SubmitButton className="btn-burgundy btn-sm">Add variant</SubmitButton>
          </form>
        </Panel>

        <Panel title="Inventory">
          <p className="text-sm">
            {product.trackInventory && product.stockQuantity != null ? <>Tracked stock: <strong>{product.stockQuantity}</strong> (low-stock at {product.lowStockThreshold})</> : <>Stock quantity is <strong>not tracked</strong> — availability shows as “{product.stockStatus.replace(/_/g, " ").toLowerCase()}”.</>}
          </p>
          <form action={adjustStockAction} className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="stock-form">
            <Back href={here} />
            <input type="hidden" name="productId" value={id} />
            <Select name="mode" id="st-mode" label="Action" options={[["set", "Set quantity to"], ["adjust", "Adjust by (+/−)"]]} />
            <TextField name="quantity" id="st-qty" label="Quantity" type="number" required />
            {product.variants.length > 0 && <Select name="variantId" id="st-var" label="Apply to" options={[["", "Main product"], ...product.variants.map((v) => [v.id, v.name] as [string, string])]} />}
            <div className="sm:col-span-2"><TextField name="reason" id="st-reason" label="Reason" placeholder="e.g. Stock count, supplier delivery" required /></div>
            <SubmitButton className="btn-burgundy btn-sm">Update stock</SubmitButton>
          </form>
          {product.trackInventory && (
            <form action={untrackStockAction} className="mt-2"><Back href={here} /><input type="hidden" name="productId" value={id} /><button className="text-xs font-semibold text-grey-600 hover:underline">Stop tracking quantity</button></form>
          )}
          {moves.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-grey-100 pt-3 text-xs text-grey-600">
              {moves.map((m) => <li key={m.m.id}>{formatDate(m.m.createdAt, true)} · {m.m.delta > 0 ? "+" : ""}{m.m.delta} · {m.m.reason}</li>)}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Suppliers, costs & margin">
        {refs.length === 0 ? (
          <p className="text-sm text-grey-600">No supplier linked yet. The retail price is a planning price until a supplier cost is verified.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="table-admin">
              <thead><tr><th>Supplier</th><th>Supplier SKU</th><th className="text-right">Cost</th><th className="text-right">Extra costs</th><th>Verified</th><th>Delivery estimate</th></tr></thead>
              <tbody>
                {refs.map(({ ref, supplierName, integrationStatus }) => (
                  <tr key={ref.id}>
                    <td><Link href={`/admin/suppliers/${ref.supplierId}`} className="font-medium text-burgundy hover:underline">{supplierName}</Link><span className="block text-xs text-grey-500">{integrationStatus.replace(/_/g, " ").toLowerCase()}</span></td>
                    <td>{ref.supplierSku ?? "—"}{ref.supplierProductUrl && <a href={ref.supplierProductUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-burgundy">↗</a>}</td>
                    <td className="text-right">{ref.costMinor != null ? formatKobo(ref.costMinor, ref.costCurrency) : "—"}</td>
                    <td className="text-right">{formatKobo(ref.additionalCostsKobo)}</td>
                    <td>{ref.costVerifiedAt ? formatDate(ref.costVerifiedAt) : <span className="text-amber-700">no</span>}</td>
                    <td>{ref.deliveryEstimateText ? `${ref.deliveryEstimateText}${ref.deliveryEstimateSource ? ` (${ref.deliveryEstimateSource})` : ""}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 rounded-xl bg-grey-50 p-4 text-sm">
          <p className="font-semibold">Margin</p>
          {margin.available ? (
            <p className="mt-1">Selling {formatKobo(product.salePriceKobo ?? product.retailPriceKobo)} − cost {formatKobo(margin.costKobo)} = <strong className={margin.marginKobo < 0 ? "text-red-700" : "text-lime-800"}>{formatKobo(margin.marginKobo)} ({margin.marginPercent}%)</strong>. <span className="text-grey-500">{margin.includes}</span></p>
          ) : (
            <p className="mt-1 text-grey-600">Not calculated — {margin.reason}</p>
          )}
        </div>
        {suppliers.length > 0 && user.role === "ADMIN" && (
          <form action={supplierProductAction} className="mt-4 grid gap-3 sm:grid-cols-3">
            <Back href={here} />
            <input type="hidden" name="productId" value={id} />
            <Select name="supplierId" id="sp-sup" label="Supplier" options={suppliers.map((s) => [s.s.id, s.s.name] as [string, string])} />
            <TextField name="supplierSku" id="sp-sku" label="Supplier SKU" />
            <TextField name="supplierProductUrl" id="sp-url" label="Supplier product URL" type="url" />
            <TextField name="cost" id="sp-cost" label="Supplier cost" inputMode="decimal" />
            <TextField name="costCurrency" id="sp-cur" label="Currency" defaultValue="NGN" maxLength={3} />
            <TextField name="additionalCosts" id="sp-add" label="Extra procurement/shipping ₦" inputMode="decimal" />
            <TextField name="additionalCostsNote" id="sp-addn" label="What extra costs include" />
            <TextField name="deliveryEstimateText" id="sp-del" label="Delivery estimate (from supplier)" />
            <TextField name="deliveryEstimateSource" id="sp-dels" label="Estimate source" />
            <div className="sm:col-span-3"><Check name="costVerified" label="I have confirmed this cost with the supplier (quote/invoice)" /></div>
            <SubmitButton className="btn-burgundy btn-sm">Save supplier reference</SubmitButton>
          </form>
        )}
        {suppliers.length === 0 && <p className="mt-3 text-sm"><Link href="/admin/suppliers" className="font-semibold text-burgundy hover:underline">Add a supplier</Link> to record verified costs.</p>}
      </Panel>
    </AdminPage>
  );
}
