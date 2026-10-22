import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/current";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; changed?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/account");
  return (
    <AuthShell title="Sign in" subtitle="Welcome back to Code Crest." aside={<>New to Code Crest? <Link href={`/account/register${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-semibold text-burgundy hover:underline">Create an account</Link></>}>
      {sp.reset && <Notice kind="success" className="mb-4">Your password has been reset. Please sign in.</Notice>}
      {sp.changed && <Notice kind="success" className="mb-4">Password changed. Please sign in again.</Notice>}
      <LoginForm next={sp.next} />
    </AuthShell>
  );
}
