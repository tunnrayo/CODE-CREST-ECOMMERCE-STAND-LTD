import Image from "next/image";
import { CheckCircle2, Circle } from "lucide-react";
import clsx from "clsx";
import { formatDate, formatKobo, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/format";
import { StatusPill } from "@/components/ui";
import type { OrderDetail } from "@/server/services/orders";

const FLOW = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

export function OrderProgress({ status }: { status: string }) {
  if (status === "CANCELLED" || status === "REFUNDED") return <StatusPill status={status} />;
  const idx = FLOW.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Order progress" data-testid="order-progress">
      {FLOW.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={clsx("flex items-center gap-1.5 text-xs font-semibold sm:text-sm", i <= idx ? "text-burgundy" : "text-grey-400")}>
            {i <= idx ? <CheckCircle2 className="h-5 w-5 text-lime-600" /> : <Circle className="h-5 w-5" />}
            {ORDER_STATUS_LABEL[s]}
          </span>
          {i < FLOW.length - 1 && <span className={clsx("h-0.5 w-6 sm:w-10", i < idx ? "bg-lime-500" : "bg-grey-200")} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function OrderSummary({ order }: { order: Pick<OrderDetail, "items" | "subtotalKobo" | "shippingKobo" | "shippingConfirmed" | "totalKobo" | "discountKobo" | "shippingAddress" | "shippingMethodName" | "status" | "paymentStatus" | "createdAt" | "reference" | "customerName" | "email" | "phone" | "history" | "shipments" | "customerNote"> }) {
  const a = order.shippingAddress;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Items</h2>
            <span className="text-xs text-grey-500">Placed {formatDate(order.createdAt, true)}</span>
          </div>
          <ul className="mt-4 divide-y divide-grey-100">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-grey-100">{i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{i.name}</span>
                  <span className="text-xs text-grey-500">{i.variantName ? `${i.variantName} · ` : ""}SKU {i.sku} · {formatKobo(i.unitPriceKobo)} × {i.quantity}</span>
                </span>
                <span className="font-semibold">{formatKobo(i.lineTotalKobo)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-grey-200 pt-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatKobo(order.subtotalKobo)}</dd></div>
            {order.discountKobo > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatKobo(order.discountKobo)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery {order.shippingMethodName ? `(${order.shippingMethodName})` : ""}</dt><dd>{order.shippingConfirmed ? formatKobo(order.shippingKobo) : "To be confirmed"}</dd></div>
            <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd className="text-burgundy" data-testid="order-total">{formatKobo(order.totalKobo)}{order.shippingConfirmed ? "" : " + delivery"}</dd></div>
          </dl>
        </section>
        <section className="card p-6">
          <h2 className="text-lg">Order history</h2>
          <ol className="mt-4 space-y-3 border-l-2 border-grey-200 pl-4">
            {order.history.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-burgundy ring-4 ring-white" aria-hidden />
                <p className="font-medium">{ORDER_STATUS_LABEL[h.toStatus] ?? h.toStatus}</p>
                {h.note && <p className="text-grey-600">{h.note}</p>}
                <p className="text-xs text-grey-400">{formatDate(h.createdAt, true)}</p>
              </li>
            ))}
          </ol>
          {order.shipments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Delivery details</h3>
              {order.shipments.map((s) => (
                <p key={s.id} className="mt-1 text-sm text-grey-700">
                  {s.carrier}
                  {s.trackingNumber && ` · Tracking ${s.trackingNumber}`}
                  {s.trackingUrl && (
                    <>
                      {" · "}
                      <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-burgundy underline">Track with carrier</a>
                    </>
                  )}
                  {!s.carrierDataVerified && <span className="ml-1 text-xs text-grey-400">(entered by Code Crest)</span>}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
      <aside className="space-y-6">
        <section className="card p-6 text-sm">
          <h2 className="text-lg">Status</h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between"><dt>Order</dt><dd><StatusPill status={order.status} /></dd></div>
            <div className="flex justify-between"><dt>Payment</dt><dd title={PAYMENT_STATUS_LABEL[order.paymentStatus]}><StatusPill status={order.paymentStatus} /></dd></div>
          </dl>
        </section>
        <section className="card p-6 text-sm">
          <h2 className="text-lg">Delivery to</h2>
          <address className="mt-3 not-italic leading-relaxed text-grey-700">
            {a.fullName}
            <br />
            {a.line1}
            {a.line2 && (<><br />{a.line2}</>)}
            <br />
            {a.city}, {a.state}
            <br />
            Nigeria
            <br />
            {a.phone}
          </address>
          <p className="mt-3 break-all text-grey-500">{order.email}</p>
          {order.customerNote && <p className="mt-3 rounded-xl bg-grey-50 p-3 text-grey-700">Note: {order.customerNote}</p>}
        </section>
      </aside>
    </div>
  );
}
