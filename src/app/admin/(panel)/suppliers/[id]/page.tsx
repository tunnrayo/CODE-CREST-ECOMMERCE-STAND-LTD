import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, Back, Check, Panel, Select, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { requireAdminPage } from "@/server/auth/current";
import { getSupplier } from "@/server/services/suppliers";
import { formatDate, formatKobo } from "@/lib/format";
import { deleteSupplierAction, deleteSupplierProductAction, saveSupplierAction, testSupplierAction } from "../../../actions";

export const metadata = { title: "Supplier" };

export default async function SupplierDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  await requireAdminPage("suppliers:read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await getSupplier(id);
  if (!s) notFound();
  const here = `/admin/suppliers/${id}`;
  return (
    <AdminPage title={s.name} searchParams={sp} actions={<Link href="/admin/suppliers" className="btn-ghost btn-sm">← Suppliers</Link>}>
      <Panel title="Details">
        <form action={saveSupplierAction} className="grid gap-3 sm:grid-cols-2">
          <Back href={here} />
          <input type="hidden" name="id" value={id} />
          <TextField name="name" label="Supplier name" defaultValue={s.name} required />
          <TextField name="website" label="Website" type="url" defaultValue={s.website} />
          <TextField name="contactName" label="Contact name" defaultValue={s.contactName} />
          <TextField name="contactEmail" label="Contact email" type="email" defaultValue={s.contactEmail} />
          <TextField name="contactPhone" label="Contact phone" defaultValue={s.contactPhone} />
          <TextField name="country" label="Country" defaultValue={s.country} />
          <Select name="integrationType" label="Integration type" options={["MANUAL", "API"]} defaultValue={s.integrationType} />
          <Select name="integrationStatus" label="Integration status" options={["NOT_CONFIGURED", "CONFIGURED", "CONNECTED", "ERROR"]} defaultValue={s.integrationStatus} />
          <TextField name="adapterKey" label="Adapter key" defaultValue={s.adapterKey} hint="Only 'manual' is implemented. API adapters need real supplier credentials and docs." />
          <Check name="isApproved" label="Approved supplier" defaultChecked={s.isApproved} />
          <div className="sm:col-span-2"><TextField name="notes" label="Notes" defaultValue={s.notes} /></div>
          <SubmitButton className="btn-burgundy btn-sm">Save</SubmitButton>
        </form>
        <div className="mt-4 flex gap-4">
          <form action={testSupplierAction}><Back href={here} /><input type="hidden" name="id" value={id} /><button className="btn-outline btn-sm">Check configuration</button></form>
          <form action={deleteSupplierAction}><Back href="/admin/suppliers" /><input type="hidden" name="id" value={id} /><button className="text-sm font-semibold text-red-700 hover:underline">Delete supplier</button></form>
        </div>
      </Panel>
      <Panel title={`Linked products (${s.refs.length})`}>
        {s.refs.length === 0 ? <p className="text-sm text-grey-600">No products linked. Link a supplier from a product’s edit page.</p> : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="table-admin">
              <thead><tr><th>SKU</th><th>Product</th><th className="text-right">Cost</th><th>Verified</th><th></th></tr></thead>
              <tbody>
                {s.refs.map(({ ref, productName, productSku, productId }) => (
                  <tr key={ref.id}><td>{productSku}</td><td><Link className="text-burgundy hover:underline" href={`/admin/products/${productId}`}>{productName}</Link></td><td className="text-right">{ref.costMinor != null ? formatKobo(ref.costMinor, ref.costCurrency) : "—"}</td><td>{ref.costVerifiedAt ? formatDate(ref.costVerifiedAt) : "no"}</td>
                    <td><form action={deleteSupplierProductAction}><Back href={here} /><input type="hidden" name="refId" value={ref.id} /><button className="text-xs font-semibold text-red-700 hover:underline">Remove</button></form></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Integration log">
        {s.logs.length === 0 ? <p className="text-sm text-grey-600">No integration activity.</p> : <ul className="space-y-1 text-sm">{s.logs.map((l) => <li key={l.id}>{formatDate(l.createdAt, true)} · {l.action} · {l.status}{l.message ? ` · ${l.message}` : ""}</li>)}</ul>}
      </Panel>
    </AdminPage>
  );
}
