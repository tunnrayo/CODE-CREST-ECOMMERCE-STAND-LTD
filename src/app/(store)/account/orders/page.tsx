import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/current";
import { listOrdersForUser } from "@/server/services/orders";
import { formatDate, formatKobo } from "@/lib/format";

export const metadata: Metadata = { title: "Order history", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireCustomerPage("/account/orders");
  const orders = await listOrdersForUser(user.id);
  return (
    <>
      <PageHeader title="Order history">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account", href: "/account" }, { label: "Orders" }]} />
      </PageHeader>
      <div className="container-x py-8">
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" message="When you place an order it will appear here." action={<Link href="/shop" className="btn-burgundy">Shop now</Link>} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-admin" data-testid="order-history">
              <thead><tr><th>Reference</th><th>Date</th><th>Status</th><th>Payment</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/order/${o.reference}`} className="font-semibold text-burgundy hover:underline">{o.reference}</Link></td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td><StatusPill status={o.paymentStatus} /></td>
                    <td className="text-right font-medium">{formatKobo(o.totalKobo)}{o.shippingConfirmed ? "" : " + delivery"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
