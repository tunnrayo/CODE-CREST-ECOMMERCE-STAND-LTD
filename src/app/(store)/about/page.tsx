import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { LogoMark } from "@/components/brand/Logo";
import { getSettings } from "@/server/services/settings";
import { listCategories } from "@/server/services/catalogue";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "About us", description: "About Code Crest Ecommerce Stand Ltd — an Abuja-based e-commerce company. Smart Shopping. Seamless Living.", alternates: { canonical: "/about" } };

export default async function AboutPage() {
  const [s, cats] = await Promise.all([getSettings(), listCategories()]);
  return (
    <>
      <PageHeader title="About Code Crest" subtitle={s.tagline}>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About us" }]} />
      </PageHeader>
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr]">
        <div className="prose-cc">
          <h2>Who we are</h2>
          <p>{s.legalName} ({s.rcNumber}) is an e-commerce services company based in Wuse Zone 5, Abuja. Our business purpose is {BRAND.businessPurpose.toLowerCase().replace(/\.$/, "")}.</p>
          <p>Code Crest brings together useful, everyday products — from gadgets and kitchen essentials to fashion, beauty, office, kids and outdoor items — in one simple, trustworthy online store for customers in Nigeria.</p>
          <h2>What we stand for</h2>
          <ul>
            <li><strong>Clarity.</strong> Prices are shown in naira, and we confirm availability, price and delivery with you before you pay.</li>
            <li><strong>Convenience.</strong> Browse by category, search, save favourites and track your orders online.</li>
            <li><strong>Care.</strong> Real people in Abuja answer your questions by email.</li>
          </ul>
          <h2>Our catalogue</h2>
          <p>We currently list products across {cats.length} departments: {cats.map((c) => c.name).join(", ")}. We are working with suppliers to verify each product before full launch, and verified products are clearly marked.</p>
          <p>
            <Link href="/shop" className="btn-burgundy mt-2">Explore the store</Link>
          </p>
        </div>
        <aside className="h-fit rounded-3xl bg-burgundy p-8 text-white">
          <LogoMark className="h-14 w-auto" onDark />
          <h2 className="mt-5 text-xl text-white">Company details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-white/60">Registered name</dt><dd className="font-medium">{s.legalName}</dd></div>
            <div><dt className="text-white/60">Registration number</dt><dd className="font-medium">{s.rcNumber}</dd></div>
            <div><dt className="text-white/60">Address</dt><dd className="font-medium">{s.addressLines.join(", ")}</dd></div>
            <div><dt className="text-white/60">Email</dt><dd><a className="break-all font-medium text-lime hover:underline" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a></dd></div>
          </dl>
        </aside>
      </div>
    </>
  );
}
