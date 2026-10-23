import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, forbidden, unauthorized } from "../http";
import { can, createSession, destroySession, getSessionUser, SESSION_COOKIE, type Permission, type Role, type SessionUser } from "./core";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return getSessionUser(jar.get(SESSION_COOKIE)?.value);
}

export async function startSession(user: SessionUser) {
  const h = await headers();
  const { token, expiresAt } = await createSession(user.id, user.role as Role, {
    userAgent: h.get("user-agent"),
    ip: clientIp(h),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

/** For API routes: throws 401/403. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}

export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u.role, perm)) throw forbidden();
  return u;
}

/** For admin pages & server actions: redirects instead of throwing. */
export async function requireAdminPage(perm: Permission = "admin:access"): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  if (!can(u.role, perm)) {
    if (!can(u.role, "admin:access")) redirect("/admin/login?error=forbidden");
    redirect("/admin?error=forbidden");
  }
  return u;
}

export async function requireCustomerPage(next = "/account"): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return u;
}
