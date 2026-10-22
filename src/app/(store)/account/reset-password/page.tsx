import type { Metadata } from "next";
import { Notice } from "@/components/ui";
import { AuthShell } from "../AuthShell";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password">
      {token ? <ResetForm token={token} /> : <Notice kind="error">This reset link is missing its token.</Notice>}
    </AuthShell>
  );
}
