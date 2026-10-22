import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Breadcrumbs, Notice } from "@/components/ui";
import { OrderProgress, OrderSummary } from "@/components/order/OrderSummary";
import { getCurrentUser } from "@/server/auth/current";
import { can } from "@/server/auth/core";
import { getOrderForViewer } from "@/server/services/orders";
import { integrationStatus } from "@/server/services/settings";
import { PayButton } from "./PayButton";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ token?: string; placed?: string; payment?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const { token, placed, payment } = await searchParams;
  const user = await getCurrentUser();
  const order = await getOrderForViewer(reference, { token, userId: user?.id, isStaff: can(user?.role, "orders:read") });
  if (!order) notFound();
  const payConfigured = integrationStatus().payments.configured;
  const canPay =
    order.paymentStatus !== "PAID" &&
    !["CANCELLED", "REFUNDED"].includes(order.status) &&
    order.shippingConfirmed &&
    (order.mode === "LIVE" || order.status === "CONFIRMED");

  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, ...(user ? [{ label: "My orders", href: "/account/orders" }] : []), { label: `Order ${order.reference}` }]} />
      {placed && (
        <div className="mt-6 rounded-3xl bg-burgundy p-8 text-white" data-testid="order-confirmation">
          <CheckCircle2 className="h-10 w-10 text-lime" />
          <h1 className="mt-3 text-2xl text-white sm:text-3xl">{order.mode === "REQUEST" ? "Order request received" : "Order placed"} — thank you!</h1>
          <p className="mt-2 max-w-2xl text-white/85">
            Your order reference is <strong className="text-lime" data-testid="order-reference">{order.reference}</strong>.{" "}
            {order.mode === "REQUEST"
              ? "No payment has been taken. Code Crest will contact you to confirm availability, the final price and delivery, then send you a secure payment link."
              : "Please complete payment to confirm your order."}
          </p>
          <p className="mt-3 text-sm text-white/70">Keep this page&apos;s link (or your reference and email) to check your order status at any time.</p>
        </div>
      )}
      {!placed && <h1 className="mt-6 text-2xl sm:text-3xl">Order {order.reference}</h1>}
      {payment === "failed" && <Notice kind="error" className="mt-6">We could not verify a successful payment. If you were charged, please contact us with your order reference.</Notice>}
      {payment === "success" && <Notice kind="success" className="mt-6">Payment verified. Thank you!</Notice>}
      <div className="mt-6 card p-5">
        <OrderProgress status={order.status} />
      </div>
      {canPay && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-lime-300 bg-lime-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-lime-900">Your order is ready for payment.</p>
          {payConfigured ? <PayButton reference={order.reference} token={token ?? null} /> : <p className="text-sm font-medium text-grey-700">Online payment is not configured yet — Code Crest will contact you.</p>}
        </div>
      )}
      <div className="mt-6">
        <OrderSummary order={order} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop" className="btn-burgundy">Continue shopping</Link>
        <Link href="/contact" className="btn-outline">Contact us about this order</Link>
      </div>
    </div>
  );
}
