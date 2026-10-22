import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Frequently asked questions", alternates: { canonical: "/faq" } };

const FAQ: { q: string; a: React.ReactNode; text: string }[] = [
  { q: "How does ordering work right now?", text: "During our pre-launch period, checkout sends us an order request. No payment is taken at that step. We confirm availability, the final price and the delivery fee with you, then send a secure payment link.", a: <>During our pre-launch period, checkout sends us an <strong>order request</strong>. No payment is taken at that step. We confirm availability, the final price and the delivery fee with you, then send a secure payment link.</> },
  { q: "What does “Price & availability to be confirmed” mean?", text: "It means the product is listed with a planning price and has not yet been verified with a supplier. We will confirm the exact model, specifications, price and availability before you pay.", a: "It means the product is listed with a planning price and has not yet been verified with a supplier. We will confirm the exact model, specifications, price and availability before you pay." },
  { q: "How do I pay?", text: "Online payments will be processed securely through our payment provider (Paystack). We never ask for your card PIN, and we do not store card details.", a: "Online payments will be processed securely through our payment provider (Paystack). We never ask for your card PIN, and we do not store card details." },
  { q: "Where do you deliver?", text: "We serve customers in Nigeria. The delivery fee for your location is shown at checkout or confirmed with you before payment.", a: <>We serve customers in Nigeria. The delivery fee for your location is shown at checkout or confirmed with you before payment. See our <Link href="/shipping-policy" className="text-burgundy underline">Shipping & Delivery Policy</Link>.</> },
  { q: "How can I track my order?", text: "Use the Track Order page with your order reference and the email you used at checkout. Signed-in customers can also see orders in their account.", a: <>Use the <Link href="/track-order" className="text-burgundy underline">Track Order</Link> page with your order reference and the email you used at checkout. Signed-in customers can also see orders in their account.</> },
  { q: "Can I return an item?", text: "Yes, subject to our Returns & Refund Policy.", a: <>Yes, subject to our <Link href="/returns-policy" className="text-burgundy underline">Returns & Refund Policy</Link>.</> },
  { q: "Do I need an account to order?", text: "No. You can check out as a guest. An account lets you save addresses, keep a wishlist and see your order history.", a: "No. You can check out as a guest. An account lets you save addresses, keep a wishlist and see your order history." },
  { q: "Why do some products show “Image coming soon”?", text: "We are still adding product images. Until a listing has its own image it shows a neutral placeholder.", a: "We are still adding product images. Until a listing has its own image it shows a neutral placeholder." },
];

export default function FaqPage() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.text } })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader title="Frequently asked questions">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "FAQ" }]} />
      </PageHeader>
      <div className="container-x max-w-3xl space-y-3 py-10">
        {FAQ.map((f, i) => (
          <details key={i} className="group card p-5" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <span className="text-xl text-burgundy transition group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-grey-700">{f.a}</p>
          </details>
        ))}
        <p className="pt-4 text-sm text-grey-600">Still have a question? <Link href="/contact" className="font-semibold text-burgundy hover:underline">Contact us</Link>.</p>
      </div>
    </>
  );
}
