import type { Metadata } from "next";
import { Mail, MapPin, Clock } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { getSettings } from "@/server/services/settings";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Contact us", description: "Contact Code Crest Ecommerce Stand Ltd, Abuja.", alternates: { canonical: "/contact" } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const [s, sp] = await Promise.all([getSettings(), searchParams]);
  return (
    <>
      <PageHeader title="Contact us" subtitle="Questions about products, orders or partnerships? Send us a message.">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      </PageHeader>
      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="card p-6 sm:p-8">
          <ContactForm defaultSubject={sp.subject?.slice(0, 150)} />
        </div>
        <aside className="space-y-4">
          <div className="card flex gap-3 p-5">
            <Mail className="mt-0.5 h-5 w-5 text-burgundy" />
            <div><p className="font-semibold">Email</p><a href={`mailto:${s.supportEmail}`} className="break-all text-sm text-burgundy hover:underline">{s.supportEmail}</a></div>
          </div>
          <div className="card flex gap-3 p-5">
            <MapPin className="mt-0.5 h-5 w-5 text-burgundy" />
            <div><p className="font-semibold">Office</p><address className="text-sm not-italic text-grey-700">{s.addressLines.map((l) => <span key={l} className="block">{l}</span>)}</address></div>
          </div>
          <div className="card flex gap-3 p-5">
            <Clock className="mt-0.5 h-5 w-5 text-burgundy" />
            <div><p className="font-semibold">Response</p><p className="text-sm text-grey-700">We reply by email. Please include your order reference if your message is about an order.</p></div>
          </div>
        </aside>
      </div>
    </>
  );
}
