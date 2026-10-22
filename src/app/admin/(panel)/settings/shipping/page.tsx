import Link from "next/link";
import { AdminPage, Back, Check, Panel, TextField, koboToInput, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { Notice } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { NIGERIAN_STATES, listZonesWithMethods } from "@/server/services/shipping";
import { deleteMethodAction, saveMethodAction, saveZoneAction } from "../../../actions";

export const metadata = { title: "Delivery settings" };

export default async function ShippingSettings({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("settings:write");
  const [sp, zones] = await Promise.all([searchParams, listZonesWithMethods()]);
  const here = "/admin/settings/shipping";
  return (
    <AdminPage title="Delivery zones & fees" searchParams={sp} actions={<Link href="/admin/settings" className="btn-ghost btn-sm">← Settings</Link>}>
      <Notice kind="info">A method with no confirmed fee is shown to customers as “to be confirmed” and the order total excludes it. Only mark a fee confirmed once you have agreed it with your courier.</Notice>
      {zones.map((z) => (
        <Panel key={z.id} title={z.name}>
          <form action={saveZoneAction} className="grid gap-3">
            <Back href={here} />
            <input type="hidden" name="id" value={z.id} />
            <TextField name="name" id={`zn-${z.id}`} label="Zone name" defaultValue={z.name} required />
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-burgundy">States covered ({z.states.length || "all"})</summary>
              <div className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
                {NIGERIAN_STATES.map((st) => <label key={st} className="flex items-center gap-1"><input type="checkbox" name="states" value={st} defaultChecked={z.states.includes(st)} className="accent-burgundy" /> {st}</label>)}
              </div>
              <p className="mt-1 text-xs text-grey-500">Leave all unticked to cover every state.</p>
            </details>
            <Check name="isActive" label="Active" defaultChecked={z.isActive} />
            <SubmitButton className="btn-outline btn-sm">Save zone</SubmitButton>
          </form>
          <div className="mt-5 space-y-3">
            {z.methods.map((m) => (
              <div key={m.id} className="rounded-xl border border-grey-200 p-3">
                <form action={saveMethodAction} className="grid gap-3 sm:grid-cols-3">
                  <Back href={here} />
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="zoneId" value={z.id} />
                  <TextField name="name" id={`mn-${m.id}`} label="Method" defaultValue={m.name} required />
                  <TextField name="fee" id={`mf-${m.id}`} label="Fee ₦" defaultValue={koboToInput(m.feeKobo)} inputMode="decimal" />
                  <TextField name="freeOver" id={`mo-${m.id}`} label="Free over ₦" defaultValue={koboToInput(m.freeOverKobo)} inputMode="decimal" />
                  <TextField name="estimatedDeliveryText" id={`me-${m.id}`} label="Estimate text" defaultValue={m.estimatedDeliveryText} />
                  <TextField name="description" id={`md-${m.id}`} label="Description" defaultValue={m.description} />
                  <TextField name="position" id={`mp-${m.id}`} label="Order" type="number" defaultValue={m.position} />
                  <Check name="feeConfirmed" label="Fee confirmed" defaultChecked={m.feeConfirmed} />
                  <Check name="isActive" label="Active" defaultChecked={m.isActive} />
                  <SubmitButton className="btn-outline btn-sm">Save method</SubmitButton>
                </form>
                <form action={deleteMethodAction} className="mt-2"><Back href={here} /><input type="hidden" name="id" value={m.id} /><button className="text-xs font-semibold text-red-700 hover:underline">Delete method</button></form>
              </div>
            ))}
            <form action={saveMethodAction} className="grid gap-3 rounded-xl bg-grey-50 p-3 sm:grid-cols-3">
              <Back href={here} />
              <input type="hidden" name="zoneId" value={z.id} />
              <TextField name="name" id={`nm-${z.id}`} label="New method name" required />
              <TextField name="fee" id={`nf-${z.id}`} label="Fee ₦ (blank = TBC)" inputMode="decimal" />
              <TextField name="estimatedDeliveryText" id={`ne-${z.id}`} label="Estimate text" />
              <Check name="feeConfirmed" label="Fee confirmed" />
              <Check name="isActive" label="Active" defaultChecked />
              <SubmitButton className="btn-burgundy btn-sm">Add method</SubmitButton>
            </form>
          </div>
        </Panel>
      ))}
      <Panel title="Add zone">
        <form action={saveZoneAction} className="flex flex-wrap items-end gap-3">
          <Back href={here} />
          <TextField name="name" id="nz-name" label="Zone name" required />
          <Check name="isActive" label="Active" defaultChecked />
          <SubmitButton className="btn-burgundy btn-sm">Add zone</SubmitButton>
        </form>
      </Panel>
    </AdminPage>
  );
}
