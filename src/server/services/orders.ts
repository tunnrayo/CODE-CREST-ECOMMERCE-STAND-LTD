import crypto from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { formatKobo } from "@/lib/format";
import { db, type Tx } from "../db";
import {
  cartItems,
  inventoryMovements,
  orderItems,
  orderNotes,
  orderStatusHistory,
  orders,
  paymentTransactions,
  productVariants,
  products,
  shipments,
} from "../db/schema";
import { sha256 } from "../auth/core";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../http";
import { audit, type Actor } from "./audit";
import { notifyAdmins, sendEmail } from "./notifications";
import { quoteLines } from "./pricing";
import { getSettings, integrationStatus } from "./settings";
import { NIGERIAN_STATES, shippingFeeFor, shippingOptionsFor } from "./shipping";

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  line1: z.string().trim().min(3, "Enter your street address").max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z.enum(NIGERIAN_STATES, { errorMap: () => ({ message: "Choose your state" }) }),
  country: z.literal("NG").default("NG"),
  shippingMethodId: z.string().uuid("Choose a delivery option"),
  note: z.string().trim().max(500).optional().nullable(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the terms to continue" }) }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};
const REQUIRES_PAYMENT = new Set(["PROCESSING", "SHIPPED", "DELIVERED"]);

function generateReference() {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `CC-${ymd}-${suffix}`;
}

export type CreatedOrder = { id: string; reference: string; accessToken: string; totalKobo: number; mode: "REQUEST" | "LIVE"; shippingConfirmed: boolean };

/**
 * Creates an order from the cart inside a single transaction.
 * All prices, stock and shipping fees are recalculated from the database.
 */
export async function createOrderFromCart(cartId: string, userId: string | null, input: CheckoutInput): Promise<CreatedOrder> {
  const settings = await getSettings();
  const mode = settings.orderMode;
  const options = await shippingOptionsFor(input.country, input.state);
  const option = options.find((o) => o.id === input.shippingMethodId);
  if (!option) throw badRequest("The selected delivery option is not available for this address.");

  if (mode === "LIVE") {
    if (!integrationStatus().payments.configured) throw new ApiError(503, "PAYMENTS_NOT_CONFIGURED", "Online payment is not available yet. Please try again later.");
    if (!option.feeConfirmed) throw badRequest("The delivery fee for this option has not been confirmed yet.");
  }

  const accessToken = crypto.randomBytes(24).toString("base64url");

  const result = await db.transaction(async (tx) => {
    // Serialise concurrent checkouts of the same cart (double-click / retries): the second waits here,
    // then finds the cart already emptied by the first and is rejected instead of creating a duplicate order.
    await tx.execute(sql`select id from carts where id = ${cartId} for update`);
    const items = await tx.select().from(cartItems).where(eq(cartItems.cartId, cartId)).orderBy(asc(cartItems.createdAt));
    if (!items.length) throw badRequest("Your cart is empty.");
    const quote = await quoteLines(
      items.map((i) => ({ itemId: i.id, productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      { tx, lock: true },
    );
    const problems = quote.lines.filter((l) => l.problem);
    if (problems.length) throw conflict("Some items in your cart need attention.", problems.map((p) => ({ name: p.name, problem: p.problem })));
    if (mode === "LIVE" && quote.lines.some((l) => l.verificationStatus !== "SUPPLIER_VERIFIED")) {
      throw conflict("Some items have not been verified with a supplier yet and cannot be paid for online.");
    }

    const fee = shippingFeeFor(option, quote.subtotalKobo);
    const shippingKobo = fee ?? 0;
    const totalKobo = quote.subtotalKobo + shippingKobo;

    let reference = generateReference();
    for (let i = 0; i < 5; i++) {
      const [exists] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.reference, reference)).limit(1);
      if (!exists) break;
      reference = generateReference();
    }

    const [order] = await tx
      .insert(orders)
      .values({
        reference,
        userId,
        email: input.email,
        customerName: input.fullName,
        phone: input.phone,
        shippingAddress: {
          fullName: input.fullName,
          phone: input.phone,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          state: input.state,
          country: input.country,
        },
        status: "PENDING",
        paymentStatus: "UNPAID",
        mode,
        currency: "NGN",
        subtotalKobo: quote.subtotalKobo,
        shippingKobo,
        shippingConfirmed: fee != null,
        totalKobo,
        shippingMethodId: option.id,
        shippingMethodName: option.name,
        customerNote: input.note ?? null,
        accessTokenHash: sha256(accessToken),
      })
      .returning();

    await tx.insert(orderItems).values(
      quote.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        variantId: l.variantId,
        sku: l.sku,
        name: l.name,
        variantName: l.variantName,
        imageUrl: l.imageUrl,
        unitPriceKobo: l.unitPriceKobo,
        quantity: l.quantity,
        lineTotalKobo: l.lineTotalKobo,
      })),
    );

    // Reserve tracked stock.
    for (const l of quote.lines) {
      if (!l.trackInventory) continue;
      if (l.variantId) {
        await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} - ${l.quantity}` }).where(eq(productVariants.id, l.variantId));
      } else {
        await tx.update(products).set({ stockQuantity: sql`${products.stockQuantity} - ${l.quantity}` }).where(eq(products.id, l.productId));
        await refreshStockStatus(tx, l.productId);
      }
      await tx.insert(inventoryMovements).values({ productId: l.productId, variantId: l.variantId, delta: -l.quantity, reason: "ORDER_PLACED", orderId: order.id });
    }

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: "PENDING",
      note: mode === "REQUEST" ? "Order request received. Code Crest will confirm availability, price and delivery before payment." : "Order placed — awaiting payment.",
    });
    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
    return { order, lines: quote.lines };
  });

  const { order, lines } = result;
  const itemsText = lines.map((l) => `• ${l.name}${l.variantName ? ` (${l.variantName})` : ""} × ${l.quantity} — ${formatKobo(l.lineTotalKobo)}`).join("\n");
  const appUrl = process.env.APP_URL ?? "";
  await sendEmail({
    type: "ORDER_CONFIRMATION",
    to: order.email,
    relatedOrderId: order.id,
    subject: `Code Crest order ${order.reference} received`,
    body: `Hello ${order.customerName},\n\nThank you for your order with Code Crest. Reference: ${order.reference}\n\n${itemsText}\n\nSubtotal: ${formatKobo(order.subtotalKobo)}\nDelivery: ${order.shippingConfirmed ? formatKobo(order.shippingKobo) : "to be confirmed"}\nTotal: ${formatKobo(order.totalKobo)}${order.shippingConfirmed ? "" : " + delivery"}\n\n${
      mode === "REQUEST" ? "We will contact you to confirm availability, final price and delivery before any payment is taken." : "Please complete payment to confirm your order."
    }\n\nView your order: ${appUrl}/order/${order.reference}?token=${accessToken}\n\nCode Crest Ecommerce Stand Ltd — Smart Shopping. Seamless Living.`,
  });
  await notifyAdmins(`New order ${order.reference}`, `A new ${mode === "REQUEST" ? "order request" : "order"} was placed: ${order.reference} — ${formatKobo(order.totalKobo)} — ${order.customerName} (${order.email}).`, order.id);

  return { id: order.id, reference: order.reference, accessToken, totalKobo: order.totalKobo, mode, shippingConfirmed: order.shippingConfirmed };
}

export async function refreshStockStatus(tx: Tx, productId: string) {
  await tx
    .update(products)
    .set({
      stockStatus: sql`case
        when not ${products.trackInventory} or ${products.stockQuantity} is null then ${products.stockStatus}
        when ${products.stockQuantity} <= 0 then 'OUT_OF_STOCK'::stock_status
        when ${products.stockQuantity} <= ${products.lowStockThreshold} then 'LOW_STOCK'::stock_status
        else 'IN_STOCK'::stock_status end`,
    })
    .where(eq(products.id, productId));
}

/** Load an order if the viewer is entitled to see it (owner, valid access token, or staff). */
export async function getOrderForViewer(reference: string, viewer: { token?: string | null; userId?: string | null; isStaff?: boolean }) {
  const [order] = await db.select().from(orders).where(eq(orders.reference, reference)).limit(1);
  if (!order) return null;
  const tokenOk = !!viewer.token && crypto.timingSafeEqual(Buffer.from(sha256(viewer.token)), Buffer.from(order.accessTokenHash));
  const ownerOk = !!viewer.userId && order.userId === viewer.userId;
  if (!tokenOk && !ownerOk && !viewer.isStaff) return null;
  return loadOrderDetail(order.id);
}

export async function loadOrderDetail(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const [items, history, ships, txs] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId)).orderBy(asc(orderStatusHistory.createdAt)),
    db.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.createdAt)),
    db.select().from(paymentTransactions).where(eq(paymentTransactions.orderId, orderId)).orderBy(desc(paymentTransactions.createdAt)),
  ]);
  const { accessTokenHash: _omit, ...safe } = order;
  void _omit;
  return { ...safe, items, history, shipments: ships, transactions: txs };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;

/** Public tracking: reference + matching email. Returns a limited view. */
export async function trackOrder(reference: string, email: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.reference, reference.trim().toUpperCase()), sql`lower(${orders.email}) = ${email.trim().toLowerCase()}`))
    .limit(1);
  if (!order) return null;
  const d = await loadOrderDetail(order.id);
  if (!d) return null;
  return {
    reference: d.reference,
    status: d.status,
    paymentStatus: d.paymentStatus,
    createdAt: d.createdAt,
    totalKobo: d.totalKobo,
    shippingConfirmed: d.shippingConfirmed,
    itemCount: d.items.reduce((s, i) => s + i.quantity, 0),
    history: d.history.map((h) => ({ toStatus: h.toStatus, note: h.note, createdAt: h.createdAt })),
    shipments: d.shipments.map((s) => ({ carrier: s.carrier, trackingNumber: s.trackingNumber, trackingUrl: s.trackingUrl, status: s.status, carrierDataVerified: s.carrierDataVerified, shippedAt: s.shippedAt })),
  };
}

export async function listOrdersForUser(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(100);
}

/* ───────────────────────── Admin ───────────────────────── */
export const adminOrderListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
  paymentStatus: z.enum(["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export async function adminListOrders(input: Partial<z.infer<typeof adminOrderListSchema>>) {
  const q = adminOrderListSchema.parse(input);
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(orders.status, q.status));
  if (q.paymentStatus) conds.push(eq(orders.paymentStatus, q.paymentStatus));
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, "\\$&")}%`;
    conds.push(or(ilike(orders.reference, like), ilike(orders.email, like), ilike(orders.customerName, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);
  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage);
  return { items: rows.map(({ accessTokenHash: _h, ...r }) => (void _h, r)), total: Number(total), page: q.page, perPage: q.perPage, pageCount: Math.max(1, Math.ceil(Number(total) / q.perPage)) };
}

export const statusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function updateOrderStatus(orderId: string, input: z.infer<typeof statusUpdateSchema>, actor: Actor) {
  const data = statusUpdateSchema.parse(input);
  const updated = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order not found");
    const allowed = ORDER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(data.status)) throw badRequest(`An order cannot move from ${order.status} to ${data.status}.`);
    if (REQUIRES_PAYMENT.has(data.status) && order.paymentStatus !== "PAID") {
      throw badRequest("Payment must be verified (or recorded through the audited manual payment process) before the order can move to this status.");
    }
    if (data.status === "CONFIRMED" && !order.shippingConfirmed) {
      throw badRequest("Confirm the delivery fee for this order before confirming it.");
    }
    if (data.status === "CANCELLED") {
      if (order.paymentStatus === "PAID") throw badRequest("This order has a verified payment. Process a refund through the payment provider before cancelling.");
      await restock(tx, order.id, actor);
    }
    const [u] = await tx.update(orders).set({ status: data.status, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    await tx.insert(orderStatusHistory).values({ orderId, fromStatus: order.status, toStatus: data.status, note: data.note ?? null, actorUserId: actor?.id ?? null });
    await audit(actor, "order.status", "order", orderId, { from: order.status, to: data.status, note: data.note }, tx);
    return u;
  });
  await sendEmail({
    type: "ORDER_STATUS",
    to: updated.email,
    relatedOrderId: updated.id,
    subject: `Your Code Crest order ${updated.reference} is now ${data.status.toLowerCase()}`,
    body: `Hello ${updated.customerName},\n\nYour order ${updated.reference} status is now: ${data.status}.${data.note ? `\n\nNote: ${data.note}` : ""}\n\nCode Crest Ecommerce Stand Ltd`,
  });
  return updated;
}

async function restock(tx: Tx, orderId: string, actor: Actor) {
  const moves = await tx.select().from(inventoryMovements).where(and(eq(inventoryMovements.orderId, orderId), eq(inventoryMovements.reason, "ORDER_PLACED")));
  for (const m of moves) {
    if (m.variantId) await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} + ${-m.delta}` }).where(eq(productVariants.id, m.variantId));
    else {
      await tx.update(products).set({ stockQuantity: sql`${products.stockQuantity} + ${-m.delta}` }).where(eq(products.id, m.productId));
      await refreshStockStatus(tx, m.productId);
    }
    await tx.insert(inventoryMovements).values({ productId: m.productId, variantId: m.variantId, delta: -m.delta, reason: "ORDER_CANCELLED", orderId, actorUserId: actor?.id ?? null });
  }
}

export const confirmShippingSchema = z.object({ shippingKobo: z.number().int().min(0).max(100_000_000), note: z.string().trim().max(300).optional().nullable() });

/** Admin confirms the delivery fee for an order whose fee was "to be confirmed". */
export async function confirmOrderShipping(orderId: string, input: z.infer<typeof confirmShippingSchema>, actor: Actor) {
  const data = confirmShippingSchema.parse(input);
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order not found");
    if (order.paymentStatus === "PAID" || order.paymentStatus === "PENDING") throw badRequest("Delivery fee cannot be changed after payment has started.");
    if (!["PENDING", "CONFIRMED"].includes(order.status)) throw badRequest("Delivery fee can only be set on pending or confirmed orders.");
    const [u] = await tx
      .update(orders)
      .set({ shippingKobo: data.shippingKobo, shippingConfirmed: true, totalKobo: order.subtotalKobo - order.discountKobo + data.shippingKobo, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    await tx.insert(orderStatusHistory).values({ orderId, fromStatus: order.status, toStatus: order.status, note: `Delivery fee confirmed: ${formatKobo(data.shippingKobo)}${data.note ? ` — ${data.note}` : ""}`, actorUserId: actor?.id ?? null });
    await audit(actor, "order.shipping_confirmed", "order", orderId, { shippingKobo: data.shippingKobo, previous: order.shippingKobo }, tx);
    return u;
  });
}

export async function addOrderNote(orderId: string, body: string, actor: Actor) {
  const text = z.string().trim().min(1).max(2000).parse(body);
  const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId));
  if (!o) throw notFound("Order not found");
  const [n] = await db.insert(orderNotes).values({ orderId, body: text, authorUserId: actor?.id ?? null }).returning();
  await audit(actor, "order.note", "order", orderId, { noteId: n.id });
  return n;
}

export async function listOrderNotes(orderId: string) {
  return db.select().from(orderNotes).where(eq(orderNotes.orderId, orderId)).orderBy(desc(orderNotes.createdAt));
}

export const shipmentSchema = z.object({
  carrier: z.string().trim().min(2).max(80),
  trackingNumber: z.string().trim().max(80).optional().nullable(),
  trackingUrl: z.string().trim().url().max(300).optional().nullable().or(z.literal("").transform(() => null)),
  notes: z.string().trim().max(300).optional().nullable(),
});

/** Manually recorded shipment details (carrierDataVerified stays false until a carrier integration supplies data). */
export async function addShipment(orderId: string, input: z.infer<typeof shipmentSchema>, actor: Actor) {
  const data = shipmentSchema.parse(input);
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw notFound("Order not found");
  const [s] = await db
    .insert(shipments)
    .values({ orderId, carrier: data.carrier, trackingNumber: data.trackingNumber ?? null, trackingUrl: data.trackingUrl ?? null, notes: data.notes ?? null, status: "RECORDED", carrierDataVerified: false })
    .returning();
  await audit(actor, "order.shipment_added", "order", orderId, { shipmentId: s.id, carrier: data.carrier });
  return s;
}

export const manualPaymentSchema = z.object({
  method: z.enum(["BANK_TRANSFER", "POS", "OTHER"]),
  amountKobo: z.number().int().positive(),
  externalReference: z.string().trim().min(4, "Enter the bank/transaction reference").max(120),
  confirmation: z.literal(true, { errorMap: () => ({ message: "Confirm you have checked the funds in the business account" }) }),
});

/**
 * Admin-only, audited process for recording an offline payment that has been
 * checked against the business bank account. Recorded distinctly from
 * gateway-verified payments (provider = MANUAL_*, verifiedVia = admin email).
 */
export async function recordManualPayment(orderId: string, input: z.infer<typeof manualPaymentSchema>, actor: NonNullable<Actor> & { role: string }) {
  if (actor.role !== "ADMIN") throw forbidden("Only administrators can record manual payments.");
  const data = manualPaymentSchema.parse(input);
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order not found");
    if (order.paymentStatus === "PAID") throw conflict("This order is already marked as paid.");
    if (!order.shippingConfirmed) throw badRequest("Confirm the delivery fee before recording payment.");
    if (data.amountKobo !== order.totalKobo) throw badRequest(`Amount must equal the order total (${formatKobo(order.totalKobo)}).`);
    const reference = `${order.reference}-M${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await tx.insert(paymentTransactions).values({
      orderId,
      provider: `MANUAL_${data.method}`,
      reference,
      amountKobo: data.amountKobo,
      currency: order.currency,
      status: "SUCCESS",
      mode: "LIVE",
      providerTransactionId: data.externalReference,
      gatewayResponse: "Recorded manually by administrator",
      verifiedAt: new Date(),
      verifiedVia: `admin:${actor.email}`,
    });
    const [u] = await tx.update(orders).set({ paymentStatus: "PAID", updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    await tx.insert(orderStatusHistory).values({ orderId, fromStatus: order.status, toStatus: order.status, note: `Manual ${data.method.replace("_", " ").toLowerCase()} payment recorded by ${actor.email}`, actorUserId: actor.id });
    await audit(actor, "payment.manual_recorded", "order", orderId, { method: data.method, amountKobo: data.amountKobo, externalReference: data.externalReference });
    return u;
  });
}

export async function orderStats() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const byStatus = await db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status);
  const [paid] = await db
    .select({ n: count(), sum: sql<number>`coalesce(sum(${orders.totalKobo}),0)::bigint` })
    .from(orders)
    .where(eq(orders.paymentStatus, "PAID"));
  const [paid30] = await db
    .select({ n: count(), sum: sql<number>`coalesce(sum(${orders.totalKobo}),0)::bigint` })
    .from(orders)
    .where(and(eq(orders.paymentStatus, "PAID"), gte(orders.createdAt, since)));
  const [all] = await db.select({ n: count() }).from(orders);
  const recent = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
  return {
    totalOrders: Number(all.n),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
    paidOrders: Number(paid.n),
    paidRevenueKobo: Number(paid.sum),
    paidOrders30d: Number(paid30.n),
    paidRevenue30dKobo: Number(paid30.sum),
    recent: recent.map(({ accessTokenHash: _h, ...r }) => (void _h, r)),
  };
}
