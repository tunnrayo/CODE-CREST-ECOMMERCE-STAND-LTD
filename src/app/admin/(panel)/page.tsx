import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { AdminPage, Panel, Stat, type SP } from "@/components/admin/AdminUI";
import { Notice, StatusPill } from "@/components/ui";
import { db } from "@/server/db";
import { contactMessages, notifications, products } from "@/server/db/schema";
import { orderStats } from "@/server/services/orders";
import { getImageReport, inventoryOverview } from "@/server/services/admin-catalogue";
import { getSettings, integrationStatus } from "@/server/services/settings";
import { formatDate, formatKobo } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [byStatus, byVerification, stats, inv, images, settings, [newMsgs], [unsent]] = await Promise.all([
    db.select({ status: products.status, n: count() }).from(products).groupBy(products.status),
    db.select({ v: products.verificationStatus, n: count() }).from(products).groupBy(products.verificationStatus),
    orderStats(),
    inventoryOverview(),
    getImageReport(),
    getSettings(),
    db.select({ n: count() }).from(contactMessages).where(eq(contactMessages.status, "NEW")),
    db.select({ n: count() }).from(notifications).where(sql`${notifications.status} in ('NOT_CONFIGURED','FAILED')`),
  ]);
  const s = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]));
  const v = Object.fromEntries(byVerification.map((r) => [r.v, Number(r.n)]));
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  const integ = integrationStatus();

  return (
    <AdminPage title="Dashboard" subtitle="Live figures from the Code Crest database." searchParams={sp}>
      {sp.error === "forbidden" && <Notice kind="error">You don&apos;t have permission to open that page.</Notice>}
      <div className="grid gap-3 lg:grid-cols-3">
        {settings.orderMode === "REQUEST" && (
          <Notice kind="info" title="Order mode: REQUEST (pre-launch)">Customers submit order requests; no online payment is taken until you confirm the order and delivery fee.</Notice>
        )}
        {!integ.payments.configured && <Notice kind="warning" title="Payments not configured">Add PAYSTACK_SECRET_KEY to enable online payment. No payment has been processed by this system.</Notice>}
        {!integ.email.configured && <Notice kind="warning" title="Email not configured">{Number(unsent.n)} notification(s) stored but not sent. Add RESEND_API_KEY and EMAIL_FROM.</Notice>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Products" value={total} hint={`${s.PUBLISHED ?? 0} published · ${s.DRAFT ?? 0} draft · ${s.ARCHIVED ?? 0} archived`} href="/admin/products" />
        <Stat label="Supplier-verified" value={`${v.SUPPLIER_VERIFIED ?? 0} / ${total}`} hint={`${v.UNVERIFIED ?? 0} awaiting supplier verification`} href="/admin/products?verification=UNVERIFIED" />
        <Stat label="Orders" value={stats.totalOrders} hint={`${stats.byStatus.PENDING ?? 0} pending review`} href="/admin/orders" />
        <Stat label="Verified paid revenue" value={formatKobo(stats.paidRevenueKobo)} hint={`${stats.paidOrders} paid order(s) · last 30 days ${formatKobo(stats.paidRevenue30dKobo)}`} href="/admin/payments" />
        <Stat label="Images verified" value={`${images.summary.verified} / ${images.summary.total}`} hint={`${images.summary.illustration} illustrations awaiting photos`} href="/admin/images" />
        <Stat label="Stock tracked" value={inv.trackedCount} hint={`${inv.untrackedCount} with unknown stock`} href="/admin/inventory" />
        <Stat label="Low / out of stock" value={`${inv.lowStock.length} / ${inv.outOfStock.length}`} href="/admin/inventory" />
        <Stat label="New messages" value={Number(newMsgs.n)} href="/admin/messages" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-sm font-semibold text-burgundy">All orders →</Link>}>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-grey-600">No orders yet. Orders placed on the storefront will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-admin">
                <thead><tr><th>Reference</th><th>Customer</th><th>Date</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {stats.recent.map((o) => (
                    <tr key={o.id}>
                      <td><Link className="font-semibold text-burgundy hover:underline" href={`/admin/orders/${o.id}`}>{o.reference}</Link></td>
                      <td>{o.customerName}</td>
                      <td className="whitespace-nowrap">{formatDate(o.createdAt, true)}</td>
                      <td><StatusPill status={o.status} /></td>
                      <td><StatusPill status={o.paymentStatus} /></td>
                      <td className="text-right">{formatKobo(o.totalKobo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Orders by status">
          <ul className="space-y-2 text-sm">
            {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].map((st) => (
              <li key={st} className="flex items-center justify-between">
                <Link href={`/admin/orders?status=${st}`} className="hover:underline"><StatusPill status={st} /></Link>
                <span className="font-semibold">{stats.byStatus[st] ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-grey-500">Revenue figures only include orders with a verified payment (gateway-verified or audited manual record).</p>
        </Panel>
      </div>

      {inv.lowStock.length > 0 && (
        <Panel title="Inventory warnings">
          <ul className="text-sm">
            {inv.lowStock.map((r) => (
              <li key={r.p.id}><Link href={`/admin/products/${r.p.id}`} className="text-burgundy hover:underline">{r.p.name}</Link> — {r.p.stockQuantity} left</li>
            ))}
          </ul>
        </Panel>
      )}
    </AdminPage>
  );
}
