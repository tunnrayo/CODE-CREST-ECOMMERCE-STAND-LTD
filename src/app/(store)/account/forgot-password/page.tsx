import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { ForgotForm } from "../forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll prepare a reset link." aside={<Link href="/account/login" className="font-semibold text-burgundy hover:underline">← Back to sign in</Link>}>
      <ForgotForm />
    </AuthShell>
  );
}
