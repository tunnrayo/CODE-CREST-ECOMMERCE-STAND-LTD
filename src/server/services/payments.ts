import crypto from "node:crypto";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { orderStatusHistory, orders, paymentTransactions, webhookEvents } from "../db/schema";
import { ApiError, badRequest, conflict, notFound } from "../http";
import { audit } from "./audit";
import { sendEmail } from "./notifications";
import { formatKobo } from "@/lib/format";

/**
 * Paystack integration (https://paystack.com/docs/api/).
 * - Amounts are sent in kobo.
 * - An order is marked PAID only after server-side verification
 *   (GET /transaction/verify/:reference) confirms status, amount and currency.
 * - Webhooks are authenticated with HMAC-SHA512 (x-paystack-signature) and
 *   de-duplicated; they trigger the same server-side verification.
 */
const PAYSTACK_BASE = process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co";

function secretKey(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Online payment is not configured yet. Code Crest will contact you to arrange payment.");
  return k;
}
export const paymentsConfigured = () => !!process.env.PAYSTACK_SECRET_KEY;
const keyMode = (): "TEST" | "LIVE" => ((process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_live_") ? "LIVE" : "TEST");

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !json.status) throw new ApiError(502, "PAYMENT_PROVIDER_ERROR", `Payment provider error: ${json.message ?? res.status}`);
  return json.data as T;
}

export async function initializePayment(orderId: string, payerEmail: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw notFound("Order not found");
  if (order.paymentStatus === "PAID") throw conflict("This order has already been paid.");
  if (["CANCELLED", "REFUNDED"].includes(order.status)) throw badRequest("This order can no longer be paid.");
  if (!order.shippingConfirmed) throw badRequest("The delivery fee for this order has not been confirmed yet. Code Crest will contact you.");
  if (order.mode === "REQUEST" && order.status !== "CONFIRMED") throw badRequest("This order request has not been confirmed by Code Crest yet.");
  if (order.totalKobo <= 0) throw badRequest("Invalid order total.");
  secretKey();

  const [{ n }] = await db.select({ n: count() }).from(paymentTransactions).where(eq(paymentTransactions.orderId, orderId));
  const reference = `${order.reference}-P${Number(n) + 1}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  await db.insert(paymentTransactions).values({
    orderId,
    provider: "PAYSTACK",
    reference,
    amountKobo: order.totalKobo,
    currency: order.currency,
    status: "INITIATED",
    mode: keyMode(),
  });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const data = await paystack<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: payerEmail,
      amount: order.totalKobo,
      currency: order.currency,
      reference,
      callback_url: `${appUrl}/checkout/payment/callback`,
      metadata: { orderReference: order.reference, orderId: order.id },
    }),
  });
  await db.update(paymentTransactions).set({ status: "PENDING", updatedAt: new Date() }).where(eq(paymentTransactions.reference, reference));
  await db.update(orders).set({ paymentStatus: "PENDING", updatedAt: new Date() }).where(and(eq(orders.id, orderId), inArray(orders.paymentStatus, ["UNPAID", "FAILED"])));
  return { authorizationUrl: data.authorization_url, reference };
}

type PaystackVerify = { id: number; status: string; reference: string; amount: number; currency: string; gateway_response?: string; paid_at?: string; channel?: string };

/** Server-side verification. Idempotent: safe to call from callback and webhook. */
export async function verifyPayment(reference: string, via: "callback" | "webhook" | "admin") {
  const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).limit(1);
  if (!tx) throw notFound("Payment reference not found");
  if (tx.status === "SUCCESS") return { status: "SUCCESS" as const, orderId: tx.orderId, alreadyVerified: true };

  const data = await paystack<PaystackVerify>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const amountOk = data.amount === tx.amountKobo;
  const currencyOk = data.currency === tx.currency;
  const refOk = data.reference === tx.reference;
  const success = data.status === "success" && amountOk && currencyOk && refOk;
  const safeData = { id: data.id, status: data.status, amount: data.amount, currency: data.currency, channel: data.channel, paid_at: data.paid_at, gateway_response: data.gateway_response };

  if (success) {
    await db.transaction(async (t) => {
      const [locked] = await t.select().from(paymentTransactions).where(eq(paymentTransactions.id, tx.id)).for("update");
      if (locked.status === "SUCCESS") return;
      await t
        .update(paymentTransactions)
        .set({ status: "SUCCESS", providerTransactionId: String(data.id), gatewayResponse: data.gateway_response ?? null, verificationData: safeData, verifiedAt: new Date(), verifiedVia: via, updatedAt: new Date() })
        .where(eq(paymentTransactions.id, tx.id));
      const [order] = await t.select().from(orders).where(eq(orders.id, tx.orderId)).for("update");
      const nextStatus = order.status === "PENDING" ? "CONFIRMED" : order.status;
      await t.update(orders).set({ paymentStatus: "PAID", status: nextStatus, updatedAt: new Date() }).where(eq(orders.id, order.id));
      await t.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: order.status, toStatus: nextStatus, note: `Payment verified with Paystack (${via}).` });
    });
    const [order] = await db.select().from(orders).where(eq(orders.id, tx.orderId));
    await sendEmail({
      type: "PAYMENT_CONFIRMATION",
      to: order.email,
      relatedOrderId: order.id,
      subject: `Payment received for Code Crest order ${order.reference}`,
      body: `Hello ${order.customerName},\n\nWe have verified your payment of ${formatKobo(tx.amountKobo)} for order ${order.reference}.\n\nCode Crest Ecommerce Stand Ltd`,
    });
    await audit(null, "payment.verified", "order", tx.orderId, { reference, via });
    return { status: "SUCCESS" as const, orderId: tx.orderId, alreadyVerified: false };
  }

  const failed = ["failed", "reversed"].includes(data.status) || (data.status === "success" && (!amountOk || !currencyOk || !refOk));
  const newStatus = failed ? "FAILED" : data.status === "abandoned" ? "ABANDONED" : "PENDING";
  await db
    .update(paymentTransactions)
    .set({ status: newStatus, gatewayResponse: data.gateway_response ?? null, verificationData: { ...safeData, amountOk, currencyOk, refOk }, updatedAt: new Date() })
    .where(eq(paymentTransactions.id, tx.id));
  if (newStatus === "FAILED") {
    await db.update(orders).set({ paymentStatus: "FAILED", updatedAt: new Date() }).where(and(eq(orders.id, tx.orderId), inArray(orders.paymentStatus, ["PENDING", "UNPAID"])));
    if (data.status === "success") await audit(null, "payment.mismatch", "order", tx.orderId, { reference, amountOk, currencyOk, refOk });
  }
  return { status: newStatus, orderId: tx.orderId, alreadyVerified: false };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const expected = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function handlePaystackWebhook(rawBody: string, signature: string | null) {
  const valid = verifyWebhookSignature(rawBody, signature);
  if (!valid) return { status: 401, result: "invalid-signature" };
  let event: { event?: string; data?: { id?: number; reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, result: "bad-json" };
  }
  const type = event.event ?? "unknown";
  const eventKey = `paystack:${type}:${event.data?.id ?? ""}:${event.data?.reference ?? crypto.createHash("sha256").update(rawBody).digest("hex")}`;
  const inserted = await db.insert(webhookEvents).values({ provider: "PAYSTACK", eventKey, eventType: type, signatureValid: true }).onConflictDoNothing().returning({ id: webhookEvents.id });
  if (!inserted.length) return { status: 200, result: "duplicate" };

  let result = "ignored";
  try {
    if (type === "charge.success" && event.data?.reference) {
      const r = await verifyPayment(event.data.reference, "webhook");
      result = `verified:${r.status}`;
    } else if (type === "refund.processed" && event.data?.reference) {
      result = await markRefunded(event.data.reference);
    }
  } catch (e) {
    result = `error:${(e as Error).message.slice(0, 200)}`;
  }
  await db.update(webhookEvents).set({ processedAt: new Date(), result }).where(eq(webhookEvents.id, inserted[0].id));
  return { status: 200, result };
}

async function markRefunded(reference: string) {
  const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference)).limit(1);
  if (!tx || tx.status !== "SUCCESS") return "refund-ignored";
  await db.transaction(async (t) => {
    await t.update(paymentTransactions).set({ status: "REFUNDED", updatedAt: new Date() }).where(eq(paymentTransactions.id, tx.id));
    const [o] = await t.select().from(orders).where(eq(orders.id, tx.orderId)).for("update");
    await t.update(orders).set({ paymentStatus: "REFUNDED", status: "REFUNDED", updatedAt: new Date() }).where(eq(orders.id, o.id));
    await t.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: o.status, toStatus: "REFUNDED", note: "Refund confirmed by Paystack webhook." });
  });
  return "refunded";
}

export async function listTransactions(limit = 100) {
  return db
    .select({ tx: paymentTransactions, orderReference: orders.reference, customerEmail: orders.email })
    .from(paymentTransactions)
    .innerJoin(orders, eq(orders.id, paymentTransactions.orderId))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(limit);
}

export async function listWebhookEvents(limit = 50) {
  return db.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(limit);
}
