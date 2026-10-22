import { desc } from "drizzle-orm";
import { AdminPage, Back, Panel, type SP } from "@/components/admin/AdminUI";
import { requireAdminPage } from "@/server/auth/current";
import { db } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { formatDate } from "@/lib/format";
import { messageStatusAction } from "../../actions";

export const metadata = { title: "Messages" };

export default async function Messages({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("orders:read");
  const [sp, rows] = await Promise.all([searchParams, db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(200)]);
  return (
    <AdminPage title="Customer messages" searchParams={sp}>
      {rows.length === 0 && <p className="text-sm text-grey-600">No messages yet.</p>}
      {rows.map((m) => (
        <Panel key={m.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold">{m.subject}</p><p className="text-sm text-grey-600">{m.name} · <a className="text-burgundy underline" href={`mailto:${m.email}`}>{m.email}</a> · {formatDate(m.createdAt, true)}</p></div>
            <form action={messageStatusAction}><Back href="/admin/messages" /><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={m.status === "NEW" ? "RESOLVED" : "NEW"} /><button className="btn-outline btn-sm">{m.status === "NEW" ? "Mark resolved" : "Reopen"}</button></form>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
          <p className="mt-2 text-xs text-grey-500">{m.status}</p>
        </Panel>
      ))}
    </AdminPage>
  );
}
