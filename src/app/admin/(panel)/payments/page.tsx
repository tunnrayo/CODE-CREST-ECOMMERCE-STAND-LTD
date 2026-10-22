import { AdminPage, Panel, type SP } from "@/components/admin/AdminUI";
import { Notice, StatusPill } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { listTransactions, listWebhookEvents } from "@/server/services/payments";
import { integrationStatus } from "@/server/services/settings";
import { formatDate, formatKobo } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Payments" };

export default async function Payments({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("payments:read");
  const [sp, txs, hooks] = await Promise.all([searchParams, listTransactions(), listWebhookEvents()]);
  const integ = integrationStatus();
  return (
    <AdminPage title="Payments" searchParams={sp}>
      {integ.payments.configured ? (
        <Notice kind="info" title={`Paystack ${integ.payments.mode} keys present`}>Payments are only marked paid after server-side verification of status, amount, currency and reference. Webhook URL to register in Paystack: <code>/api/v1/payments/webhooks/paystack</code></Notice>
      ) : (
        <Notice kind="warning" title="Paystack not configured">Set PAYSTACK_SECRET_KEY (and PAYSTACK_PUBLIC_KEY) in the environment. Until then no online payment can be taken and no payment has been processed.</Notice>
      )}
      <Panel title="Transactions">
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th>Date</th><th>Order</th><th>Provider</th><th>Reference</th><th>Mode</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {txs.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-grey-500">No payment transactions yet.</td></tr>}
              {txs.map(({ tx, orderReference }) => (
                <tr key={tx.id}><td className="whitespace-nowrap">{formatDate(tx.createdAt, true)}</td><td><Link className="text-burgundy hover:underline" href={`/admin/orders?q=${orderReference}`}>{orderReference}</Link></td><td>{tx.provider}</td><td className="text-xs">{tx.reference}</td><td>{tx.mode}</td><td><StatusPill status={tx.status} /></td><td className="text-right">{formatKobo(tx.amountKobo)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Webhook events">
        {hooks.length === 0 ? <p className="text-sm text-grey-600">No webhook events received.</p> : (
          <ul className="space-y-1 text-sm">{hooks.map((h) => <li key={h.id}>{formatDate(h.receivedAt, true)} · {h.provider} · {h.eventType} · signature {h.signatureValid ? "valid" : "INVALID"} · {h.result ?? "—"}</li>)}</ul>
        )}
      </Panel>
    </AdminPage>
  );
}
