import { eq } from "drizzle-orm";
import { db } from "../db";
import { notifications } from "../db/schema";
import { getSettings } from "./settings";

/**
 * Email notification outbox. Every message is stored. It is only marked SENT
 * after the configured provider (Resend) accepts it. Without RESEND_API_KEY
 * and EMAIL_FROM the status is NOT_CONFIGURED — nothing is claimed as sent.
 */
export async function sendEmail(input: { type: string; to: string; subject: string; body: string; relatedOrderId?: string | null }) {
  const configured = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  const [row] = await db
    .insert(notifications)
    .values({
      type: input.type,
      toEmail: input.to,
      subject: input.subject.slice(0, 200),
      body: input.body,
      status: configured ? "QUEUED" : "NOT_CONFIGURED",
      provider: configured ? "resend" : null,
      relatedOrderId: input.relatedOrderId ?? null,
    })
    .returning();
  if (!configured) return row;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    await db.update(notifications).set({ status: "SENT", sentAt: new Date() }).where(eq(notifications.id, row.id));
    return { ...row, status: "SENT" as const };
  } catch (e) {
    await db.update(notifications).set({ status: "FAILED", error: (e as Error).message.slice(0, 500) }).where(eq(notifications.id, row.id));
    return { ...row, status: "FAILED" as const };
  }
}

export async function notifyAdmins(subject: string, body: string, relatedOrderId?: string) {
  const s = await getSettings();
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || s.supportEmail;
  return sendEmail({ type: "ADMIN_ALERT", to, subject, body, relatedOrderId });
}
