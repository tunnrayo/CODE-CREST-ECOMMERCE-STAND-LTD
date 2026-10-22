import { Back, Check, Panel, Select, TextField, koboToInput } from "./AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";

type Cat = { id: string; name: string };
type P = {
  id?: string;
  name?: string;
  slug?: string;
  sku?: string;
  categoryId?: string;
  description?: string;
  keywords?: string;
  specifications?: { label: string; value: string }[];
  status?: string;
  isFeatured?: boolean;
  retailPriceKobo?: number;
  salePriceKobo?: number | null;
  basePlanningPriceKobo?: number | null;
  catalogueSuggestedPriceKobo?: number | null;
  verificationStatus?: string;
  pricingNote?: string | null;
  trackInventory?: boolean;
  stockStatus?: string;
  lowStockThreshold?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export function ProductForm({ action, product = {}, categories, backHref }: { action: (fd: FormData) => Promise<void>; product?: P; categories: Cat[]; backHref: string }) {
  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[2fr_1fr]" data-testid="product-form">
      <Back href={backHref} />
      {product.id && <input type="hidden" name="id" value={product.id} />}
      <div className="space-y-6">
        <Panel title="Product details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><TextField name="name" label="Name" defaultValue={product.name} required maxLength={160} /></div>
            <TextField name="sku" label="SKU" defaultValue={product.sku} required maxLength={40} pattern="[A-Za-z0-9\-_]+" />
            <TextField name="slug" label="URL slug" defaultValue={product.slug} placeholder="auto from name" hint="Lowercase letters, numbers and dashes. Changing it changes the product URL." />
            <div className="sm:col-span-2">
              <label htmlFor="t-description" className="label">Description</label>
              <textarea id="t-description" name="description" defaultValue={product.description} rows={4} maxLength={5000} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="t-specs" className="label">Verified specifications (one per line: Label: Value)</label>
              <textarea id="t-specs" name="specifications" defaultValue={(product.specifications ?? []).map((s) => `${s.label}: ${s.value}`).join("\n")} rows={4} className="input font-mono text-xs" placeholder={"Capacity: 20,000mAh\nOutput: 22.5W"} />
              <p className="mt-1 text-xs text-grey-500">Only enter specifications confirmed by the supplier or manufacturer.</p>
            </div>
            <div className="sm:col-span-2"><TextField name="keywords" label="Search keywords" defaultValue={product.keywords} maxLength={500} /></div>
          </div>
        </Panel>
        <Panel title="Pricing (₦)">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="retailPrice" label="Retail selling price" defaultValue={koboToInput(product.retailPriceKobo)} required inputMode="decimal" />
            <TextField name="salePrice" label="Discounted price (optional)" defaultValue={koboToInput(product.salePriceKobo)} inputMode="decimal" hint="Must be lower than retail." />
            <TextField name="basePlanningPrice" label="Original planning price" defaultValue={koboToInput(product.basePlanningPriceKobo)} inputMode="decimal" hint="From the catalogue. Not a supplier cost." />
            <div className="sm:col-span-3"><TextField name="pricingNote" label="Pricing note (internal)" defaultValue={product.pricingNote} maxLength={500} /></div>
          </div>
          {product.catalogueSuggestedPriceKobo != null && (
            <p className="mt-3 text-xs text-grey-500">Catalogue suggested retail at import: ₦{(product.catalogueSuggestedPriceKobo / 100).toLocaleString("en-NG")} (₦10,000 rule already applied in the document — do not add it again).</p>
          )}
        </Panel>
        <Panel title="SEO">
          <div className="grid gap-4">
            <TextField name="seoTitle" label="SEO title (max 70)" defaultValue={product.seoTitle} maxLength={70} />
            <TextField name="seoDescription" label="Meta description (max 160)" defaultValue={product.seoDescription} maxLength={160} />
          </div>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel title="Publishing">
          <div className="space-y-4">
            <Select name="status" label="Status" options={["PUBLISHED", "DRAFT", "ARCHIVED"]} defaultValue={product.status ?? "DRAFT"} />
            <Select name="categoryId" label="Category" options={categories.map((c) => [c.id, c.name] as [string, string])} defaultValue={product.categoryId} />
            <Select name="verificationStatus" label="Supplier verification" options={[["UNVERIFIED", "Unverified (planning data)"], ["SUPPLIER_VERIFIED", "Supplier verified"]]} defaultValue={product.verificationStatus ?? "UNVERIFIED"} />
            <p className="text-xs text-grey-500">Mark as verified only after confirming the supplier, cost, specifications and availability.</p>
            <Check name="isFeatured" label="Feature on homepage" defaultChecked={product.isFeatured} />
          </div>
        </Panel>
        <Panel title="Availability">
          <div className="space-y-4">
            <Select name="stockStatus" label="Stock status (when not tracking quantity)" options={[["UNKNOWN", "Unknown / to be confirmed"], ["IN_STOCK", "In stock"], ["LOW_STOCK", "Low stock"], ["OUT_OF_STOCK", "Out of stock"]]} defaultValue={product.stockStatus ?? "UNKNOWN"} />
            <Check name="trackInventory" label="Track stock quantity" defaultChecked={product.trackInventory} />
            <TextField name="lowStockThreshold" label="Low-stock threshold" type="number" min={0} defaultValue={product.lowStockThreshold ?? 5} />
          </div>
        </Panel>
        <SubmitButton className="btn-primary w-full py-3">{product.id ? "Save product" : "Create product"}</SubmitButton>
      </div>
    </form>
  );
}
