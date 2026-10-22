import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, Back, Check, Panel, Select, TextField, type SP } from "@/components/admin/AdminUI";
import { SubmitButton } from "@/components/forms/ActionForm";
import { StatusPill } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { can } from "@/server/auth/core";
import { ORDER_TRANSITIONS, listOrderNotes, loadOrderDetail } from "@/server/services/orders";
import { formatDate, formatKobo } from "@/lib/format";
import { manualPaymentAction, orderNoteAction, orderShipmentAction, orderShippingAction, orderStatusAction } from "../../../actions";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requireAdminPage("orders:read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await loadOrderDetail(id);
  if (!o) notFound();
  const notes = await listOrderNotes(id);
  const here = `/admin/orders/${id}`;
  const next = (ORDER_TRANSITIONS[o.status] ?? []).filter((s) => ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(s));
  const a = o.shippingAddress;
  const canWrite = can(user.role, "orders:write");
  return (
    <AdminPage title={`Order ${o.reference}`} subtitle={`Placed ${formatDate(o.createdAt, true)} · mode ${o.mode}`} searchParams={sp} actions={<Link href="/admin/orders" className="btn-ghost btn-sm">← Orders</Link>}>
      <div className="flex flex-wrap gap-2"><StatusPill status={o.status} /><StatusPill status={o.paymentStatus} />{!o.shippingConfirmed && <span className="badge bg-amber-50 text-amber-800">delivery fee not confirmed</span>}</div>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Panel title="Items">
            <table className="table-admin">
              <thead><tr><th>SKU</th><th>Item</th><th className="text-right">Unit</th><th className="text-right">Qty</th><th className="text-right">Line</th></tr></thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}><td>{i.sku}</td><td>{i.name}{i.variantName ? ` — ${i.variantName}` : ""}</td><td className="text-right">{formatKobo(i.unitPriceKobo)}</td><td className="text-right">{i.quantity}</td><td className="text-right">{formatKobo(i.lineTotalKobo)}</td></tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatKobo(o.subtotalKobo)}</dd></div>
              {o.discountKobo > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatKobo(o.discountKobo)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery {o.shippingConfirmed ? "" : "(unconfirmed)"}</dt><dd>{o.shippingConfirmed ? formatKobo(o.shippingKobo) : "TBC"}</dd></div>
              <div className="flex justify-between border-t pt-1 font-bold"><dt>Total</dt><dd>{formatKobo(o.totalKobo)}</dd></div>
            </dl>
          </Panel>

          <Panel title="History">
            <ol className="space-y-2 text-sm">
              {o.history.map((h) => <li key={h.id}>{formatDate(h.createdAt, true)} — {h.fromStatus ? `${h.fromStatus} → ` : ""}<strong>{h.toStatus}</strong>{h.note ? ` · ${h.note}` : ""}</li>)}
            </ol>
          </Panel>

          <Panel title="Payments">
            {o.transactions.length === 0 ? <p className="text-sm text-grey-600">No payment transactions. No payment has been recorded for this order.</p> : (
              <ul className="space-y-2 text-sm">
                {o.transactions.map((t) => <li key={t.id}>{t.provider} · {t.reference} · {formatKobo(t.amountKobo)} · <StatusPill status={t.status} /> · {t.mode}{t.verifiedAt ? ` · verified ${formatDate(t.verifiedAt, true)} via ${t.verifiedVia}` : ""}</li>)}
              </ul>
            )}
            {user.role === "ADMIN" && o.paymentStatus !== "PAID" && o.shippingConfirmed && (
              <form action={manualPaymentAction} className="mt-4 grid gap-3 rounded-xl bg-grey-50 p-4 sm:grid-cols-2" data-testid="manual-payment-form">
                <Back href={here} />
                <input type="hidden" name="orderId" value={id} />
                <div className="sm:col-span-2"><p className="text-sm font-semibold">Record a manual payment (audited)</p><p className="text-xs text-grey-500">Only after you have confirmed the money in your account. The amount must equal the order total ({formatKobo(o.totalKobo)}).</p></div>
                <Select name="method" id="mp-method" label="Method" options={[["BANK_TRANSFER", "Bank transfer"], ["CASH", "Cash"], ["POS", "POS"], ["OTHER", "Other"]]} />
                <TextField name="amount" id="mp-amt" label="Amount ₦" inputMode="decimal" required defaultValue={String(o.totalKobo / 100)} />
                <div className="sm:col-span-2"><TextField name="externalReference" id="mp-ref" label="Bank/receipt reference" required /></div>
                <div className="sm:col-span-2"><Check name="confirmation" label="I confirm this payment has been received" /></div>
                <SubmitButton className="btn-burgundy btn-sm">Record payment</SubmitButton>
              </form>
            )}
            {o.paymentStatus !== "PAID" && !o.shippingConfirmed && <p className="mt-3 text-xs text-grey-500">Confirm the delivery fee before recording or requesting payment.</p>}
          </Panel>

          <Panel title="Shipments">
            {o.shipments.length === 0 && <p className="text-sm text-grey-600">No shipment recorded. Tracking details entered here are typed in by staff and are shown to customers as such.</p>}
            <ul className="space-y-2 text-sm">
              {o.shipments.map((s) => <li key={s.id}>{s.carrier}{s.trackingNumber ? ` · ${s.trackingNumber}` : ""}{s.trackingUrl ? <> · <a className="text-burgundy underline" href={s.trackingUrl} target="_blank" rel="noopener noreferrer">track</a></> : null} · {formatDate(s.createdAt)}</li>)}
            </ul>
            {canWrite && (
              <form action={orderShipmentAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <Back href={here} />
                <input type="hidden" name="orderId" value={id} />
                <TextField name="carrier" id="sh-c" label="Carrier / courier" required />
                <TextField name="trackingNumber" id="sh-t" label="Tracking number" />
                <TextField name="trackingUrl" id="sh-u" label="Tracking URL" type="url" />
                <TextField name="notes" id="sh-n" label="Notes" />
                <SubmitButton className="btn-outline btn-sm">Record shipment</SubmitButton>
              </form>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-medium">{o.customerName}</p>
            <p className="text-sm">{o.email}</p>
            <p className="text-sm">{o.phone}</p>
            <p className="mt-3 text-sm">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state}<br />{a.country}</p>
            {o.customerNote && <p className="mt-3 rounded-lg bg-grey-50 p-3 text-sm">“{o.customerNote}”</p>}
          </Panel>

          {canWrite && (
            <Panel title="Update status">
              {next.length === 0 ? <p className="text-sm text-grey-600">No further status changes available.</p> : (
                <form action={orderStatusAction} className="space-y-3" data-testid="status-form">
                  <Back href={here} />
                  <input type="hidden" name="orderId" value={id} />
                  <Select name="status" id="os-status" label="New status" options={next} />
                  <TextField name="note" id="os-note" label="Note (optional)" />
                  <SubmitButton className="btn-burgundy btn-sm">Update</SubmitButton>
                </form>
              )}
            </Panel>
          )}

          {canWrite && (
            <Panel title="Delivery fee">
              <form action={orderShippingAction} className="space-y-3">
                <Back href={here} />
                <input type="hidden" name="orderId" value={id} />
                <TextField name="shippingFee" id="sf-fee" label="Confirmed delivery fee ₦ (0 = free)" inputMode="decimal" required defaultValue={o.shippingConfirmed ? String(o.shippingKobo / 100) : ""} />
                <TextField name="note" id="sf-note" label="Note" />
                <SubmitButton className="btn-outline btn-sm">{o.shippingConfirmed ? "Update fee" : "Confirm fee"}</SubmitButton>
              </form>
            </Panel>
          )}

          <Panel title="Internal notes">
            <ul className="space-y-2 text-sm">{notes.map((n) => <li key={n.id} className="rounded-lg bg-grey-50 p-2">{n.body}<span className="block text-xs text-grey-500">{formatDate(n.createdAt, true)}</span></li>)}</ul>
            {canWrite && (
              <form action={orderNoteAction} className="mt-3 space-y-2">
                <Back href={here} />
                <input type="hidden" name="orderId" value={id} />
                <textarea name="body" required rows={2} maxLength={1000} className="input" aria-label="Note" />
                <SubmitButton className="btn-outline btn-sm">Add note</SubmitButton>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
