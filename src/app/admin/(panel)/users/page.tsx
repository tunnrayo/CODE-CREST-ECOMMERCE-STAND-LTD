import { desc, ne, sql } from "drizzle-orm";
import { AdminPage, Back, Panel, Select, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { requireAdminPage } from "@/server/auth/current";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { formatDate } from "@/lib/format";
import { createStaffAction, setUserActiveAction, setUserRoleAction } from "../../actions";

export const metadata = { title: "Team & users" };

export default async function Users({ searchParams }: { searchParams: SP }) {
  const me = await requireAdminPage("users:manage");
  const sp = await searchParams;
  const staff = await db.select().from(users).where(ne(users.role, "CUSTOMER")).orderBy(desc(users.createdAt));
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(sql`${users.role} = 'CUSTOMER'`);
  return (
    <AdminPage title="Team & users" subtitle={`${n} customer account(s). Customers are not listed here to protect their privacy.`} searchParams={sp}>
      <div className="overflow-x-auto rounded-2xl border border-grey-200 bg-white">
        <table className="table-admin">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Active</th></tr></thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td>{u.id === me.id ? u.role : (
                  <form action={setUserRoleAction} className="flex gap-1"><Back href="/admin/users" /><input type="hidden" name="id" value={u.id} /><select name="role" defaultValue={u.role} className="input !py-1 text-xs" aria-label={`Role for ${u.email}`}><option>CUSTOMER</option><option>STAFF</option><option>ADMIN</option></select><button className="btn-outline btn-sm">Set</button></form>
                )}</td>
                <td>{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : "—"}</td>
                <td>{u.id === me.id ? "yes (you)" : (
                  <form action={setUserActiveAction}><Back href="/admin/users" /><input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.isActive ? "" : "on"} /><button className="btn-outline btn-sm">{u.isActive ? "Deactivate" : "Activate"}</button></form>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Panel title="Add a team member">
        <form action={createStaffAction} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
          <Back href="/admin/users" />
          <TextField name="name" label="Full name" required />
          <TextField name="email" label="Email" type="email" required />
          <TextField name="password" label="Temporary password" type="password" required minLength={10} autoComplete="new-password" hint="At least 10 characters with mixed character types." />
          <Select name="role" label="Role" options={["STAFF", "ADMIN"]} />
          <SubmitButton className="btn-burgundy btn-sm">Create</SubmitButton>
        </form>
        <p className="mt-3 text-xs text-grey-500">STAFF can manage catalogue, inventory and orders. ADMIN can also manage payments, suppliers, settings and users.</p>
      </Panel>
    </AdminPage>
  );
}
