import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current";
import { AuthShell } from "../AuthShell";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/account");
  return (
    <AuthShell title="Create your account" subtitle="It only takes a minute." aside={<>Already have an account? <Link href="/account/login" className="font-semibold text-burgundy hover:underline">Sign in</Link></>}>
      <RegisterForm next={sp.next} />
      <p className="mt-4 text-xs text-grey-500">By creating an account you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.</p>
    </AuthShell>
  );
}
