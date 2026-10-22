import Link from "next/link";
import { AdminPage, Back, Check, Panel, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { Notice } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { listPolicies } from "@/server/services/content";
import { savePolicyAction } from "../../../actions";

export const metadata = { title: "Policy pages" };

export default async function Policies({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("settings:write");
  const [sp, rows] = await Promise.all([searchParams, listPolicies()]);
  return (
    <AdminPage title="Policy pages" searchParams={sp} actions={<Link href="/admin/settings" className="btn-ghost btn-sm">← Settings</Link>}>
      <Notice kind="warning" title="Drafts need legal review">The seeded policies are working drafts containing [bracketed] items you must complete. Have them reviewed by a qualified Nigerian lawyer, then tick “Reviewed” to remove the draft banner from the public page.</Notice>
      {rows.map((p) => (
        <Panel key={p.slug} title={p.slug}>
          <form action={savePolicyAction} className="space-y-3">
            <Back href="/admin/settings/policies" />
            <input type="hidden" name="slug" value={p.slug} />
            <TextField name="title" id={`pt-${p.slug}`} label="Title" defaultValue={p.title} required />
            <div>
              <label htmlFor={`pb-${p.slug}`} className="label">Body (Markdown-style: ## headings, - lists)</label>
              <textarea id={`pb-${p.slug}`} name="body" rows={12} defaultValue={p.body} className="input font-mono text-xs" />
            </div>
            <Check name="isReviewed" label="Legally reviewed and approved" defaultChecked={p.isReviewed} />
            <SubmitButton className="btn-burgundy btn-sm">Save policy</SubmitButton>
          </form>
        </Panel>
      ))}
    </AdminPage>
  );
}
