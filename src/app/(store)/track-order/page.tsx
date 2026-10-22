import type { Metadata } from "next";
import { Breadcrumbs, Notice, PageHeader } from "@/components/ui";
import { TrackOrderForm } from "./TrackOrderForm";

export const metadata: Metadata = { title: "Track your order", description: "Check the status of your Code Crest order with your order reference and email address.", alternates: { canonical: "/track-order" } };

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ reference?: string; payment?: string }> }) {
  const { reference, payment } = await searchParams;
  return (
    <>
      <PageHeader title="Track your order" subtitle="Enter the order reference from your confirmation and the email address you used at checkout.">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Track order" }]} />
      </PageHeader>
      <div className="container-x max-w-3xl py-10">
        {payment === "success" && <Notice kind="success" className="mb-6">Payment verified for order {reference}. Thank you!</Notice>}
        {payment === "pending" && <Notice kind="info" className="mb-6">Your payment for order {reference} is still being confirmed. Check back shortly.</Notice>}
        {payment === "failed" && <Notice kind="error" className="mb-6">We could not verify a successful payment for order {reference}. If you were charged, please contact us.</Notice>}
        <TrackOrderForm initialReference={reference ?? ""} />
      </div>
    </>
  );
}
