import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current";
import { can } from "@/server/auth/core";
import { Logo } from "@/components/brand/Logo";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  const u = await getCurrentUser();
  if (u && can(u.role, "admin:access")) redirect("/admin");
  return (
    <div className="flex min-h-screen items-center justify-center bg-burgundy px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo onDark /></div>
        <div className="rounded-3xl bg-white p-8 shadow-2xl">
          <h1 className="text-2xl text-burgundy">Admin portal</h1>
          <p className="mt-1 text-sm text-grey-600">Authorised Code Crest staff only. All sign-in attempts are logged.</p>
          <div className="mt-6"><AdminLoginForm /></div>
        </div>
        <p className="mt-6 text-center text-xs text-white/60">Code Crest Ecommerce Stand Ltd · RC 9792990</p>
      </div>
    </div>
  );
}
