import { desc } from "drizzle-orm";
import { AdminPage, type SP } from "@/components/admin/AdminUI";
import { requireAdminPage } from "@/server/auth/current";
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("audit:read");
  const [sp, rows] = await Promise.all([searchParams, db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200)]);
  return (
    <AdminPage title="Audit log" subtitle="Latest 200 administrative actions." searchParams={sp}>
      <div className="overflow-x-auto rounded-2xl border border-grey-200 bg-white">
        <table className="table-admin">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td className="whitespace-nowrap">{formatDate(r.createdAt, true)}</td><td>{r.actorEmail ?? "system"}</td><td>{r.action}</td><td className="text-xs">{r.entityType}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}</td><td className="max-w-xs truncate text-xs text-grey-500">{r.details ? JSON.stringify(r.details) : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
