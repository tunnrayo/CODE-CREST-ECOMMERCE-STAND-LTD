import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { customerAddresses, passwordResetTokens, users, wishlistItems, products, newsletterSubscribers, contactMessages } from "../db/schema";
import { destroyAllSessions, findUserByEmail, hashPassword, normaliseEmail, randomToken, sha256, validatePasswordStrength, verifyPassword } from "../auth/core";
import { badRequest, conflict, notFound } from "../http";
import { sendEmail, notifyAdmins } from "./notifications";
import { audit } from "./audit";

const password = z.string().superRefine((v, ctx) => {
  const err = validatePasswordStrength(v);
  if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").optional().or(z.literal("").transform(() => undefined)),
  password,
});

export async function registerCustomer(input: z.input<typeof registerSchema>) {
  const d = registerSchema.parse(input);
  if (await findUserByEmail(d.email)) throw conflict("An account with this email already exists. Please sign in.");
  const [u] = await db
    .insert(users)
    .values({ name: d.name, email: normaliseEmail(d.email), phone: d.phone ?? null, passwordHash: await hashPassword(d.password), role: "CUSTOMER" })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role, phone: users.phone });
  return u;
}

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").optional().nullable().or(z.literal("").transform(() => null)),
});

export async function updateProfile(userId: string, input: z.input<typeof profileSchema>) {
  const d = profileSchema.parse(input);
  await db.update(users).set({ name: d.name, phone: d.phone ?? null, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function changePassword(userId: string, current: string, next: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !(await verifyPassword(u.passwordHash, current))) throw badRequest("Your current password is incorrect.");
  const err = validatePasswordStrength(next);
  if (err) throw badRequest(err);
  await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, userId));
  await destroyAllSessions(userId);
}

/** Always behaves the same whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(email: string) {
  const u = await findUserByEmail(email);
  if (!u || !u.isActive) return;
  const token = randomToken();
  await db.insert(passwordResetTokens).values({ id: sha256(token), userId: u.id, expiresAt: new Date(Date.now() + 60 * 60_000) });
  const link = `${process.env.APP_URL ?? ""}/account/reset-password?token=${token}`;
  await sendEmail({
    type: "PASSWORD_RESET",
    to: u.email,
    subject: "Reset your Code Crest password",
    body: `Hello ${u.name},\n\nUse this link within 1 hour to reset your password:\n${link}\n\nIf you did not request this, you can ignore this email.\n\nCode Crest`,
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const err = validatePasswordStrength(newPassword);
  if (err) throw badRequest(err);
  const [t] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.id, sha256(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())));
  if (!t) throw badRequest("This reset link is invalid or has expired.");
  await db.update(users).set({ passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, t.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, t.id));
  await destroyAllSessions(t.userId);
  await audit({ id: t.userId, email: "" }, "user.password_reset", "user", t.userId);
}

/* ── Addresses ── */
export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(40),
  isDefault: z.boolean().default(false),
});

export async function listAddresses(userId: string) {
  return db.select().from(customerAddresses).where(eq(customerAddresses.userId, userId)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
}

export async function addAddress(userId: string, input: z.input<typeof addressSchema>) {
  const d = addressSchema.parse(input);
  if (d.isDefault) await db.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.userId, userId));
  const [a] = await db.insert(customerAddresses).values({ ...d, userId, country: "NG" }).returning();
  return a;
}

export async function deleteAddress(userId: string, id: string) {
  const r = await db.delete(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, userId))).returning();
  if (!r.length) throw notFound("Address not found");
}

/* ── Wishlist ── */
export async function wishlistFor(userId: string) {
  return db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .where(and(eq(wishlistItems.userId, userId), eq(products.status, "PUBLISHED")))
    .orderBy(desc(wishlistItems.createdAt));
}

export async function toggleWishlist(userId: string, productId: string): Promise<boolean> {
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.status, "PUBLISHED")));
  if (!p) throw notFound("Product not found");
  const removed = await db.delete(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId))).returning();
  if (removed.length) return false;
  await db.insert(wishlistItems).values({ userId, productId }).onConflictDoNothing();
  return true;
}

/* ── Newsletter & contact ── */
export const newsletterSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), consent: z.literal(true, { errorMap: () => ({ message: "Please confirm you want to receive emails" }) }) });

export async function subscribeNewsletter(input: z.input<typeof newsletterSchema>, source = "website") {
  const d = newsletterSchema.parse(input);
  await db.execute(
    sql`insert into ${newsletterSubscribers} (email, source) values (${d.email}, ${source})
        on conflict (lower(email)) do update set status = 'SUBSCRIBED', unsubscribed_at = null`,
  );
}

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(4000),
  website: z.string().max(0, "Spam detected").optional().or(z.literal("")), // honeypot
});

export async function submitContactMessage(input: z.input<typeof contactSchema>) {
  const d = contactSchema.parse(input);
  const [m] = await db.insert(contactMessages).values({ name: d.name, email: d.email, subject: d.subject, message: d.message }).returning();
  const n = await notifyAdmins(`Contact form: ${d.subject}`, `From: ${d.name} <${d.email}>\n\n${d.message}`);
  return { id: m.id, emailStatus: n.status };
}
