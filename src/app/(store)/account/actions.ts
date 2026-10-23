"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { authenticate } from "@/server/auth/core";
import { endSession, getCurrentUser, requireUser, startSession } from "@/server/auth/current";
import { ApiError, clientIp } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { addAddress, changePassword, deleteAddress, registerCustomer, requestPasswordReset, resetPassword, updateProfile } from "@/server/services/accounts";

export type FormState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;

function toState(e: unknown): FormState {
  if (e instanceof ZodError) {
    const fe = e.flatten().fieldErrors as Record<string, string[] | undefined>;
    return { error: "Please check the highlighted fields.", fieldErrors: Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0] ?? "Invalid"])) };
  }
  if (e instanceof ApiError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

async function ip() {
  const h = await headers();
  return clientIp(h);
}

function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/admin") ? n : fallback;
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!rateLimit(`login:${await ip()}`, 10, 10 * 60_000).allowed) return { error: "Too many attempts. Please wait a few minutes." };
  if (!email || !password) return { error: "Enter your email and password." };
  const r = await authenticate(email, password);
  if (!r.ok) return { error: r.reason === "LOCKED" ? "Too many failed attempts. Your account is locked for 15 minutes." : "Incorrect email or password." };
  await startSession(r.user);
  redirect(safeNext(fd.get("next"), "/account"));
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`register:${await ip()}`, 5, 10 * 60_000).allowed) return { error: "Too many attempts. Please wait a few minutes." };
  try {
    if (fd.get("password") !== fd.get("confirm")) return { error: "Passwords do not match.", fieldErrors: { confirm: "Passwords do not match" } };
    const user = await registerCustomer({ name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), phone: String(fd.get("phone") ?? ""), password: String(fd.get("password") ?? "") });
    await startSession(user);
  } catch (e) {
    return toState(e);
  }
  redirect(safeNext(fd.get("next"), "/account"));
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}

export async function profileAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await requireUser();
    await updateProfile(u.id, { name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? "") });
    revalidatePath("/account");
    return { ok: true, message: "Profile updated." };
  } catch (e) {
    return toState(e);
  }
}

export async function passwordAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await requireUser();
    if (fd.get("next") !== fd.get("confirm")) return { error: "New passwords do not match." };
    await changePassword(u.id, String(fd.get("current") ?? ""), String(fd.get("next") ?? ""));
  } catch (e) {
    return toState(e);
  }
  redirect("/account/login?changed=1");
}

export async function addressAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await requireUser();
    await addAddress(u.id, {
      fullName: String(fd.get("fullName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      line1: String(fd.get("line1") ?? ""),
      line2: String(fd.get("line2") ?? "") || null,
      city: String(fd.get("city") ?? ""),
      state: String(fd.get("state") ?? ""),
      isDefault: fd.get("isDefault") === "on",
    });
    revalidatePath("/account");
    return { ok: true, message: "Address saved." };
  } catch (e) {
    return toState(e);
  }
}

export async function deleteAddressAction(fd: FormData) {
  const u = await getCurrentUser();
  if (!u) redirect("/account/login");
  await deleteAddress(u.id, String(fd.get("id")));
  revalidatePath("/account");
}

export async function forgotAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`forgot:${await ip()}`, 5, 15 * 60_000).allowed) return { error: "Too many requests. Please wait a few minutes." };
  const email = String(fd.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  await requestPasswordReset(email);
  return { ok: true, message: "If an account exists for that email, a reset link has been prepared. Note: emails are only delivered once an email service is configured for the store." };
}

export async function resetAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    if (fd.get("password") !== fd.get("confirm")) return { error: "Passwords do not match." };
    await resetPassword(String(fd.get("token") ?? ""), String(fd.get("password") ?? ""));
  } catch (e) {
    return toState(e);
  }
  redirect("/account/login?reset=1");
}
