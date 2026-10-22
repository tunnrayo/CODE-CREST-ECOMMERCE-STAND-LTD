import { AdminPage, Back, Check, Panel, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { requireAdminPage } from "@/server/auth/current";
import { can } from "@/server/auth/core";
import { listCategories } from "@/server/services/catalogue";
import { deleteCategoryAction, saveCategoryAction } from "../../actions";

export const metadata = { title: "Categories" };

export default async function Categories({ searchParams }: { searchParams: SP }) {
  const user = await requireAdminPage("catalogue:write");
  const [sp, cats] = await Promise.all([searchParams, listCategories({ includeInactive: true })]);
  const canDelete = can(user.role, "settings:write");
  return (
    <AdminPage title="Categories" subtitle="Organise the catalogue. A category with products cannot be deleted." searchParams={sp}>
      <div className="space-y-3">
        {cats.map((c) => (
          <Panel key={c.id}>
            <form action={saveCategoryAction} className="grid items-end gap-3 sm:grid-cols-6">
              <Back href="/admin/categories" />
              <input type="hidden" name="id" value={c.id} />
              <div className="sm:col-span-2"><TextField name="name" id={`n-${c.id}`} label="Name" defaultValue={c.name} required /></div>
              <TextField name="slug" id={`s-${c.id}`} label="Slug" defaultValue={c.slug} />
              <TextField name="icon" id={`i-${c.id}`} label="Icon key" defaultValue={c.icon} />
              <TextField name="position" id={`p-${c.id}`} label="Order" type="number" defaultValue={c.position} />
              <Check name="isActive" label="Active" defaultChecked={c.isActive} />
              <div className="sm:col-span-5"><TextField name="description" id={`d-${c.id}`} label="Description" defaultValue={c.description} /></div>
              <SubmitButton className="btn-burgundy btn-sm">Save</SubmitButton>
            </form>
            {canDelete && (
              <form action={deleteCategoryAction} className="mt-2"><Back href="/admin/categories" /><input type="hidden" name="id" value={c.id} /><button className="text-xs font-semibold text-red-700 hover:underline">Delete category</button></form>
            )}
          </Panel>
        ))}
      </div>
      <Panel title="Add category">
        <form action={saveCategoryAction} className="grid items-end gap-3 sm:grid-cols-6">
          <Back href="/admin/categories" />
          <div className="sm:col-span-2"><TextField name="name" id="nc-name" label="Name" required /></div>
          <TextField name="slug" id="nc-slug" label="Slug (optional)" />
          <TextField name="icon" id="nc-icon" label="Icon key" />
          <TextField name="position" id="nc-pos" label="Order" type="number" defaultValue={cats.length + 1} />
          <Check name="isActive" label="Active" defaultChecked />
          <div className="sm:col-span-5"><TextField name="description" id="nc-desc" label="Description" /></div>
          <SubmitButton className="btn-burgundy btn-sm">Create</SubmitButton>
        </form>
      </Panel>
    </AdminPage>
  );
}
