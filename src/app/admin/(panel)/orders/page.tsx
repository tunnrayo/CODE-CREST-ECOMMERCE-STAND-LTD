import Link from "next/link";
import { AdminPage, Select, TextField, type SP } from "@/components/admin/AdminUI";
import { Pagination, StatusPill } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { adminListOrders } from "@/server/services/orders";
import { formatDate, formatKobo } from "@/lib/format";

export const metadata = { title: "Orders" };

export default async function Orders({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("orders:read");
  const sp = await searchParams;
  const res = await adminListOrders({ q: sp.q || undefined, status: (sp.status || undefined) as never, paymentStatus: (sp.paymentStatus || undefined) as never, page: Number(sp.page) || 1 });
  const qs = (p: number) => { const u = new URLSearchParams(); for (const k of ["q", "status", "paymentStatus"]) if (sp[k]) u.set(k, sp[k]!); u.set("page", String(p)); return `/admin/orders?${u}`; };
  return (
    <AdminPage title="Orders" subtitle={`${res.total} order(s)`} searchParams={sp}>
      <form className="grid items-end gap-3 rounded-2xl border border-grey-200 bg-white p-4 sm:grid-cols-4" method="get">
        <TextField name="q" label="Search" defaultValue={sp.q} placeholder="Reference, email, name" />
        <Select name="status" label="Order status" defaultValue={sp.status ?? ""} options={[["", "Any"], ...["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((s) => [s, s.toLowerCase()] as [string, string])]} />
        <Select name="paymentStatus" label="Payment" defaultValue={sp.paymentStatus ?? ""} options={[["", "Any"], ...["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"].map((s) => [s, s.toLowerCase()] as [string, string])]} />
        <button className="btn-burgundy">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-grey-200 bg-white">
        <table className="table-admin" data-testid="orders-table">
          <thead><tr><th>Reference</th><th>Customer</th><th>Date</th><th>Mode</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {res.items.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-grey-500">No orders match.</td></tr>}
            {res.items.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-burgundy hover:underline">{o.reference}</Link></td>
                <td>{o.customerName}<span className="block text-xs text-grey-500">{o.email}</span></td>
                <td className="whitespace-nowrap">{formatDate(o.createdAt, true)}</td>
                <td className="text-xs">{o.mode}</td>
                <td><StatusPill status={o.status} /></td>
                <td><StatusPill status={o.paymentStatus} /></td>
                <td className="text-right">{formatKobo(o.totalKobo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={res.page} pageCount={res.pageCount} makeHref={qs} />
    </AdminPage>
  );
}
