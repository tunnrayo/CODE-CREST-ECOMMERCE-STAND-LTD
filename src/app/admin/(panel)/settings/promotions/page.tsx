import Link from "next/link";
import { AdminPage, Back, Check, Panel, Select, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { requireAdminPage } from "@/server/auth/current";
import { listPromotions } from "@/server/services/content";
import { deletePromotionAction, savePromotionAction } from "../../../actions";

export const metadata = { title: "Promotions" };

const dt = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");

export default async function Promotions({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("settings:write");
  const [sp, rows] = await Promise.all([searchParams, listPromotions()]);
  const here = "/admin/settings/promotions";
  const Form = ({ p }: { p?: (typeof rows)[number] }) => {
    const k = p?.id ?? "new";
    return (
      <form action={savePromotionAction} className="grid gap-3 sm:grid-cols-3">
        <Back href={here} />
        {p && <input type="hidden" name="id" value={p.id} />}
        <TextField name="title" id={`pt-${k}`} label="Title" defaultValue={p?.title} required />
        <TextField name="subtitle" id={`ps-${k}`} label="Subtitle" defaultValue={p?.subtitle} />
        <TextField name="badge" id={`pb-${k}`} label="Badge" defaultValue={p?.badge} />
        <TextField name="ctaLabel" id={`pl-${k}`} label="Button label" defaultValue={p?.ctaLabel} />
        <TextField name="ctaHref" id={`ph-${k}`} label="Button link (/shop…)" defaultValue={p?.ctaHref} />
        <Select name="placement" id={`pp-${k}`} label="Placement" options={["HOME_STRIP", "HOME_HERO"]} defaultValue={p?.placement} />
        <TextField name="startsAt" id={`pa-${k}`} label="Starts (UTC)" type="datetime-local" defaultValue={dt(p?.startsAt ?? null)} />
        <TextField name="endsAt" id={`pe-${k}`} label="Ends (UTC)" type="datetime-local" defaultValue={dt(p?.endsAt ?? null)} />
        <TextField name="position" id={`po-${k}`} label="Order" type="number" defaultValue={p?.position ?? 0} />
        <Check name="isActive" label="Active" defaultChecked={p?.isActive ?? true} />
        <SubmitButton className="btn-burgundy btn-sm">{p ? "Save" : "Add promotion"}</SubmitButton>
      </form>
    );
  };
  return (
    <AdminPage title="Promotions" subtitle="Homepage banners. Do not advertise discounts or offers you have not approved." searchParams={sp} actions={<Link href="/admin/settings" className="btn-ghost btn-sm">← Settings</Link>}>
      {rows.map((p) => (
        <Panel key={p.id}>
          <Form p={p} />
          <form action={deletePromotionAction} className="mt-2"><Back href={here} /><input type="hidden" name="id" value={p.id} /><button className="text-xs font-semibold text-red-700 hover:underline">Delete</button></form>
        </Panel>
      ))}
      <Panel title="New promotion"><Form /></Panel>
    </AdminPage>
  );
}
