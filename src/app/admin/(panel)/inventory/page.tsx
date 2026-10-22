import Link from "next/link";
import { AdminPage, Panel, Stat, type SP } from "@/components/admin/AdminUI";
import { requireAdminPage } from "@/server/auth/current";
import { inventoryOverview, recentMovements } from "@/server/services/admin-catalogue";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Inventory" };

export default async function Inventory({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("catalogue:write");
  const [sp, inv, moves] = await Promise.all([searchParams, inventoryOverview(), recentMovements(undefined, 25)]);
  return (
    <AdminPage title="Inventory" subtitle="Stock quantities are only shown to customers for products you choose to track. Untracked products show availability as unconfirmed." searchParams={sp}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Tracked products" value={inv.trackedCount} />
        <Stat label="Unknown stock" value={inv.untrackedCount} />
        <Stat label="Low stock" value={inv.lowStock.length} />
        <Stat label="Out of stock" value={inv.outOfStock.length} />
      </div>
      <Panel title="Products">
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Tracking</th><th className="text-right">Qty</th><th>Status</th></tr></thead>
            <tbody>
              {inv.rows.map(({ p, categoryName }) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{p.sku}</td>
                  <td><Link href={`/admin/products/${p.id}#stock-form`} className="font-medium text-burgundy hover:underline">{p.name}</Link></td>
                  <td>{categoryName}</td>
                  <td>{p.trackInventory ? "tracked" : "not tracked"}</td>
                  <td className="text-right">{p.trackInventory ? p.stockQuantity ?? 0 : "—"}</td>
                  <td>{p.stockStatus.replace(/_/g, " ").toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Recent stock movements">
        {moves.length === 0 ? <p className="text-sm text-grey-600">No stock movements recorded yet.</p> : (
          <ul className="space-y-1 text-sm">
            {moves.map(({ m, productName, sku }) => <li key={m.id}>{formatDate(m.createdAt, true)} · <strong>{sku}</strong> {productName} · {m.delta > 0 ? "+" : ""}{m.delta} · {m.reason}</li>)}
          </ul>
        )}
      </Panel>
    </AdminPage>
  );
}
