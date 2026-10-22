import Link from "next/link";
import { AdminPage, Back, Check, Panel, Select, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { Notice } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { getSettings, integrationStatus } from "@/server/services/settings";
import { orderModeAction, storeSettingsAction } from "../../actions";

export const metadata = { title: "Store settings" };

export default async function Settings({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("settings:write");
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  const integ = integrationStatus();
  return (
    <AdminPage title="Store settings" searchParams={sp}>
      <div className="flex flex-wrap gap-3 text-sm font-semibold text-burgundy">
        <Link href="/admin/settings/shipping" className="underline">Delivery zones & fees</Link>
        <Link href="/admin/settings/promotions" className="underline">Promotions</Link>
        <Link href="/admin/settings/policies" className="underline">Policy pages</Link>
      </div>
      <Panel title="Order mode">
        <p className="mb-3 text-sm text-grey-600">REQUEST: customers submit order requests and no payment is taken online. LIVE: customers can pay online once Paystack is configured and you have confirmed delivery fees.</p>
        {s.orderMode === "LIVE" && !integ.payments.configured && <Notice kind="warning">LIVE mode without Paystack keys: customers cannot pay online.</Notice>}
        <form action={orderModeAction} className="flex items-end gap-3">
          <Back href="/admin/settings" />
          <Select name="orderMode" id="om" label="Mode" options={["REQUEST", "LIVE"]} defaultValue={s.orderMode} />
          <SubmitButton className="btn-burgundy btn-sm">Apply</SubmitButton>
        </form>
      </Panel>
      <Panel title="Business information">
        <form action={storeSettingsAction} className="grid gap-3 sm:grid-cols-2">
          <Back href="/admin/settings" />
          <TextField name="storeName" label="Store name" defaultValue={s.storeName} required />
          <TextField name="legalName" label="Registered company name" defaultValue={s.legalName} required />
          <TextField name="rcNumber" label="RC number" defaultValue={s.rcNumber} required />
          <TextField name="tagline" label="Tagline" defaultValue={s.tagline} />
          <TextField name="supportEmail" label="Support email" type="email" defaultValue={s.supportEmail} required />
          <TextField name="logoUrl" label="Logo URL (optional)" defaultValue={s.logoUrl} />
          <div className="sm:col-span-2">
            <label htmlFor="addr" className="label">Address (one line per row)</label>
            <textarea id="addr" name="addressLines" rows={3} defaultValue={s.addressLines.join("\n")} className="input" />
          </div>
          <div className="sm:col-span-2"><TextField name="announcement" label="Announcement bar text" defaultValue={s.announcement} /></div>
          <div className="sm:col-span-2"><TextField name="heroTitle" label="Homepage headline" defaultValue={s.heroTitle} /></div>
          <div className="sm:col-span-2"><TextField name="heroSubtitle" label="Homepage subtitle" defaultValue={s.heroSubtitle} /></div>
          <div className="sm:col-span-2"><Check name="showUnverifiedNotice" label="Show 'prices and availability are confirmed on order' notice on product pages" defaultChecked={s.showUnverifiedNotice} /></div>
          <SubmitButton className="btn-burgundy btn-sm">Save settings</SubmitButton>
        </form>
      </Panel>
      <Panel title="Integration status (from environment)">
        <ul className="space-y-1 text-sm">
          <li>Payments (Paystack): {integ.payments.configured ? `keys present (${integ.payments.mode})` : "not configured"}</li>
          <li>Email (Resend): {integ.email.configured ? "configured" : "not configured"}</li>
        </ul>
        <p className="mt-2 text-xs text-grey-500">Secrets are set in environment variables on the server and are never shown or stored here.</p>
      </Panel>
    </AdminPage>
  );
}
