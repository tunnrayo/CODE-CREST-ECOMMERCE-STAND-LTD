import crypto from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { sessions, users } from "../db/schema";

export type Role = "CUSTOMER" | "STAFF" | "ADMIN";
export type SessionUser = { id: string; email: string; name: string; role: Role; phone: string | null };

export const SESSION_COOKIE = "cc_session";
export const CUSTOMER_SESSION_DAYS = 30;
export const ADMIN_SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const PERMISSIONS = {
  "admin:access": ["ADMIN", "STAFF"],
  "catalogue:write": ["ADMIN", "STAFF"],
  "inventory:write": ["ADMIN", "STAFF"],
  "orders:read": ["ADMIN", "STAFF"],
  "orders:write": ["ADMIN", "STAFF"],
  "suppliers:read": ["ADMIN", "STAFF"],
  "suppliers:write": ["ADMIN"],
  "payments:read": ["ADMIN"],
  "settings:write": ["ADMIN"],
  "users:manage": ["ADMIN"],
  "audit:read": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 200) return "Password is too long.";
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return "Password must include letters and numbers.";
  return null;
}

export async function hashPassword(pw: string) {
  return hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hashStr: string, pw: string) {
  try {
    return await verify(hashStr, pw);
  } catch {
    return false;
  }
}

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export function normaliseEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function findUserByEmail(email: string) {
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${normaliseEmail(email)}`).limit(1);
  return u ?? null;
}

// Pre-computed hash so failed lookups take similar time to real verifications.
let dummyHash: string | null = null;

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; reason: "INVALID" | "LOCKED" | "INACTIVE" };

export async function authenticate(email: string, password: string): Promise<LoginResult> {
  const user = await findUserByEmail(email);
  if (!user) {
    dummyHash ??= await hashPassword("timing-equaliser-password-1");
    await verifyPassword(dummyHash, password);
    return { ok: false, reason: "INVALID" };
  }
  if (!user.isActive) return { ok: false, reason: "INACTIVE" };
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, reason: "LOCKED" };
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db
      .update(users)
      .set({
        failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    return { ok: false, reason: failed >= MAX_FAILED ? "LOCKED" : "INVALID" };
  }
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone } };
}

export async function createSession(userId: string, role: Role, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const token = randomToken();
  const ms = role === "CUSTOMER" ? CUSTOMER_SESSION_DAYS * 86_400_000 : ADMIN_SESSION_HOURS * 3_600_000;
  const expiresAt = new Date(Date.now() + ms);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt, userAgent: meta.userAgent?.slice(0, 300) ?? null, ip: meta.ip ?? null });
  // opportunistic cleanup
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, phone: users.phone, isActive: users.isActive })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || !u.isActive) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function destroyAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
