import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { Logo } from "../brand/Logo";
import { NewsletterForm } from "../forms/NewsletterForm";
import type { StoreSettings } from "@/server/services/settings";

export function Footer({ settings, categories }: { settings: StoreSettings; categories: { slug: string; name: string }[] }) {
  return (
    <footer className="mt-20 bg-burgundy-800 text-white">
      <div className="bg-burgundy">
        <div className="container-x grid gap-6 py-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">Stay in the loop</h2>
            <p className="mt-1 text-sm text-white/80">Get news about new products and store updates. No spam — unsubscribe any time.</p>
          </div>
          <NewsletterForm />
        </div>
      </div>
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo onDark logoUrl={settings.logoUrl} />
          <p className="mt-4 text-sm text-white/75">{settings.tagline}</p>
          <p className="mt-4 text-xs text-white/60">
            {settings.legalName}
            <br />
            {settings.rcNumber}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-lime">Shop</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/shop" className="text-white/80 hover:text-lime">Shop all products</Link></li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="text-white/80 hover:text-lime">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-lime">Customer care</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/track-order" className="text-white/80 hover:text-lime">Track your order</Link></li>
            <li><Link href="/faq" className="text-white/80 hover:text-lime">FAQ</Link></li>
            <li><Link href="/shipping-policy" className="text-white/80 hover:text-lime">Shipping & delivery</Link></li>
            <li><Link href="/returns-policy" className="text-white/80 hover:text-lime">Returns & refunds</Link></li>
            <li><Link href="/privacy-policy" className="text-white/80 hover:text-lime">Privacy policy</Link></li>
            <li><Link href="/terms" className="text-white/80 hover:text-lime">Terms & conditions</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-lime">Contact us</h3>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />
              <address className="not-italic">{settings.addressLines.map((l) => <span key={l} className="block">{l}</span>)}</address>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />
              <a href={`mailto:${settings.supportEmail}`} className="break-all hover:text-lime">{settings.supportEmail}</a>
            </li>
          </ul>
          <Link href="/about" className="mt-4 inline-block text-sm text-white/80 hover:text-lime">About Code Crest →</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.legalName}. All rights reserved.</p>
          <p>Prices in Nigerian Naira (₦). {settings.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
