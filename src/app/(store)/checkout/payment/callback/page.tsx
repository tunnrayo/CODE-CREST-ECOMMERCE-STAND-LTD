import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orders, paymentTransactions } from "@/server/db/schema";
import { verifyPayment } from "@/server/services/payments";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Paystack redirects here after payment. The browser redirect is NOT trusted:
 * we verify the transaction server-side before showing success.
 */
export default async function PaymentCallback({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const sp = await searchParams;
  const reference = (sp.reference ?? sp.trxref ?? "").slice(0, 80);
  if (!reference) return <div className="container-x py-16"><Notice kind="error">Missing payment reference.</Notice></div>;
  const [tx] = await db.select({ orderId: paymentTransactions.orderId }).from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).limit(1);
  if (!tx) return <div className="container-x py-16"><Notice kind="error">Unknown payment reference.</Notice></div>;
  let status = "PENDING";
  try {
    status = (await verifyPayment(reference, "callback")).status;
  } catch {
    status = "ERROR";
  }
  const [order] = await db.select({ reference: orders.reference }).from(orders).where(eq(orders.id, tx.orderId));
  // Viewer still needs their access token or account to see the order; send them to tracking with a status flag.
  redirect(`/track-order?reference=${encodeURIComponent(order.reference)}&payment=${status === "SUCCESS" ? "success" : status === "PENDING" ? "pending" : "failed"}`);
}
