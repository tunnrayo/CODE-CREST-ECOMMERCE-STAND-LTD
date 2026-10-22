import Link from "next/link";
import { AdminPage, Back, Check, Panel, Select, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { Notice } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { listSuppliers } from "@/server/services/suppliers";
import { saveSupplierAction } from "../../actions";

export const metadata = { title: "Suppliers" };

export default async function Suppliers({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("suppliers:read");
  const [sp, rows] = await Promise.all([searchParams, listSuppliers()]);
  return (
    <AdminPage title="Suppliers" subtitle="Record only suppliers you have actually agreed terms with. No supplier is pre-loaded." searchParams={sp}>
      {rows.length === 0 && <Notice kind="info">No suppliers have been added. Products stay “unverified planning data” until a supplier cost is verified.</Notice>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-grey-200 bg-white">
          <table className="table-admin">
            <thead><tr><th>Supplier</th><th>Integration</th><th>Approved</th><th className="text-right">Products</th><th className="text-right">Verified costs</th></tr></thead>
            <tbody>
              {rows.map(({ s, productCount, verifiedCount }) => (
                <tr key={s.id}><td><Link className="font-semibold text-burgundy hover:underline" href={`/admin/suppliers/${s.id}`}>{s.name}</Link></td><td>{s.integrationType} · {s.integrationStatus.replace(/_/g, " ").toLowerCase()}</td><td>{s.isApproved ? "yes" : "no"}</td><td className="text-right">{productCount}</td><td className="text-right">{verifiedCount}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Panel title="Add supplier">
        <form action={saveSupplierAction} className="grid gap-3 sm:grid-cols-2">
          <Back href="/admin/suppliers" />
          <TextField name="name" label="Supplier name" required />
          <TextField name="website" label="Website" type="url" />
          <TextField name="contactName" label="Contact name" />
          <TextField name="contactEmail" label="Contact email" type="email" />
          <TextField name="contactPhone" label="Contact phone" />
          <TextField name="country" label="Country" />
          <Select name="integrationType" label="Integration" options={["MANUAL", "API"]} />
          <Check name="isApproved" label="Approved supplier" />
          <div className="sm:col-span-2"><TextField name="notes" label="Notes" /></div>
          <SubmitButton className="btn-burgundy btn-sm">Add supplier</SubmitButton>
        </form>
      </Panel>
    </AdminPage>
  );
}
