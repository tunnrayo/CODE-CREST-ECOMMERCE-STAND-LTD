import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Mail, MapPin, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductCard";
import { CategoryIcon } from "@/components/product/CategoryIcon";
import { getCurrentUser } from "@/server/auth/current";
import { listCategories, listProducts } from "@/server/services/catalogue";
import { activePromotions } from "@/server/services/content";
import { getSettings } from "@/server/services/settings";
import { wishlistFor } from "@/server/services/accounts";
import { BRAND } from "@/lib/brand";

export default async function HomePage() {
  const [settings, categories, featured, latest, electronics, home, promos, heroPromos, user] = await Promise.all([
    getSettings(),
    listCategories(),
    listProducts({ featured: true, perPage: 8 }),
    listProducts({ sort: "newest", perPage: 8 }),
    listProducts({ category: "electronics-gadgets", perPage: 4, sort: "price_desc" }),
    listProducts({ category: "home-kitchen", perPage: 4, sort: "price_desc" }),
    activePromotions("HOME_STRIP"),
    activePromotions("HOME_HERO"),
    getCurrentUser(),
  ]);
  const wish = user ? new Set((await wishlistFor(user.id)).map((w) => w.productId)) : undefined;
  const signedIn = !!user;
  const heroPromo = heroPromos[0];
  const heroImages = featured.items.slice(0, 4);
  const totalProducts = categories.reduce((s, c) => s + Number(c.productCount), 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.legalName,
    alternateName: BRAND.name,
    email: settings.supportEmail,
    address: { "@type": "PostalAddress", streetAddress: "Anbeez Plaza, Suite 1016, Ndola Crescent", addressLocality: "Wuse Zone 5, Abuja", addressRegion: "FCT", addressCountry: "NG" },
    slogan: BRAND.tagline,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero */}
      <section className="relative overflow-hidden bg-burgundy text-white">
        <svg className="pointer-events-none absolute -bottom-10 left-0 h-48 w-full text-lime/90" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden>
          <path d="M0 160 C 360 60, 760 220, 1440 40 L1440 90 C 780 260, 380 120, 0 200 Z" fill="currentColor" />
        </svg>
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-burgundy-500/40 blur-3xl" aria-hidden />
        <div className="container-x relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:py-20">
          <div className="animate-fade-up">
            {heroPromo?.badge && <span className="badge bg-lime text-burgundy-800">{heroPromo.badge}</span>}
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              {(heroPromo?.title ?? settings.heroTitle).split(". ").map((part, i, arr) => (
                <span key={i} className={i === arr.length - 1 && arr.length > 1 ? "block text-lime" : "block"}>
                  {part}
                  {i < arr.length - 1 ? "." : ""}
                </span>
              ))}
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">{heroPromo?.subtitle ?? settings.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={heroPromo?.ctaHref ?? "/shop"} className="btn-primary px-7 py-3 text-base" data-testid="hero-shop-now">
                {heroPromo?.ctaLabel ?? "Shop Now"} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/categories" className="btn border border-white/40 px-7 py-3 text-base text-white hover:bg-white/10">
                Browse categories
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-2 gap-6 text-sm">
              <div>
                <dt className="text-white/70">Products</dt>
                <dd className="text-2xl font-bold text-lime">{totalProducts}</dd>
              </div>
              <div>
                <dt className="text-white/70">Categories</dt>
                <dd className="text-2xl font-bold text-lime">{categories.length}</dd>
              </div>
            </dl>
          </div>
          <div className="relative mx-auto grid w-full max-w-lg grid-cols-2 gap-4" aria-hidden>
            {heroImages.map((p, i) => (
              <div key={p.id} className={`overflow-hidden rounded-3xl bg-white shadow-2xl ring-4 ring-white/10 ${i % 2 === 1 ? "translate-y-8" : ""}`}>
                <div className="relative aspect-square">
                  <Image src={p.image.url} alt="" fill sizes="(max-width: 1024px) 45vw, 250px" className="object-cover" priority={i < 2} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits — only things the business genuinely provides */}
      <section className="border-b border-grey-200 bg-white" aria-label="Why shop with Code Crest">
        <div className="container-x grid grid-cols-2 gap-4 py-6 lg:grid-cols-4">
          {[
            { icon: PackageSearch, title: "Curated catalogue", text: `${totalProducts} everyday products in ${categories.length} categories` },
            { icon: BadgeCheck, title: "Confirm before you pay", text: "Price, availability and delivery confirmed with you" },
            { icon: Truck, title: "Track every order", text: "Order reference and status updates online" },
            { icon: ShieldCheck, title: "Secure account", text: "Encrypted passwords and protected sessions" },
          ].map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-burgundy-50 text-burgundy">
                <b.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-xs text-grey-500">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container-x py-14" aria-labelledby="cat-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-lime-700">Shop by category</p>
            <h2 id="cat-heading" className="text-2xl sm:text-3xl">Everything you need, in one place</h2>
          </div>
          <Link href="/categories" className="hidden text-sm font-semibold text-burgundy hover:underline sm:block">
            All categories →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {categories.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="group flex flex-col items-center gap-3 rounded-2xl border border-grey-200 bg-white p-5 text-center transition hover:-translate-y-0.5 hover:border-burgundy/30 hover:shadow-card">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-burgundy text-lime transition group-hover:bg-burgundy-700">
                <CategoryIcon slug={c.slug} className="h-7 w-7" />
              </span>
              <span className="text-sm font-semibold leading-tight">{c.name}</span>
              <span className="text-xs text-grey-500">{c.productCount} products</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="bg-grey-50 py-14" aria-labelledby="featured-heading">
        <div className="container-x">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-lime-700">Featured</p>
              <h2 id="featured-heading" className="text-2xl sm:text-3xl">Popular picks across the store</h2>
            </div>
            <Link href="/shop" className="text-sm font-semibold text-burgundy hover:underline">
              Shop all →
            </Link>
          </div>
          <div className="mt-8">
            <ProductGrid products={featured.items} wishlist={wish} signedIn={signedIn} />
          </div>
        </div>
      </section>

      {/* Promotions managed in admin */}
      {promos.length > 0 && (
        <section className="container-x py-14" aria-label="Promotions">
          <div className="grid gap-4 md:grid-cols-3">
            {promos.map((p, i) => (
              <div key={p.id} className={`relative overflow-hidden rounded-3xl p-7 ${i === 0 ? "bg-burgundy text-white" : i === 1 ? "bg-lime text-burgundy-800" : "bg-burgundy-800 text-white"}`}>
                <svg className="absolute -bottom-6 -right-6 h-32 w-32 opacity-20" viewBox="0 0 100 100" aria-hidden>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="14" />
                </svg>
                {p.badge && <span className={`badge ${i === 1 ? "bg-burgundy text-white" : "bg-lime text-burgundy-800"}`}>{p.badge}</span>}
                <h3 className={`mt-3 text-xl font-semibold ${i === 1 ? "text-burgundy-800" : "text-white"}`}>{p.title}</h3>
                {p.subtitle && <p className="mt-2 text-sm opacity-85">{p.subtitle}</p>}
                {p.ctaHref && (
                  <Link href={p.ctaHref} className={`mt-5 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline ${i === 1 ? "text-burgundy" : "text-lime"}`}>
                    {p.ctaLabel ?? "Shop now"} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Spotlights */}
      {[
        { title: "Electronics & Gadgets", slug: "electronics-gadgets", items: electronics.items },
        { title: "Home & Kitchen", slug: "home-kitchen", items: home.items },
      ].map((s) => (
        <section key={s.slug} className="container-x py-8" aria-label={s.title}>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl">{s.title}</h2>
            <Link href={`/category/${s.slug}`} className="text-sm font-semibold text-burgundy hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-6">
            <ProductGrid products={s.items} wishlist={wish} signedIn={signedIn} />
          </div>
        </section>
      ))}

      {/* Latest additions from real createdAt data */}
      <section className="container-x py-8" aria-labelledby="latest-heading">
        <div className="flex items-end justify-between gap-4">
          <h2 id="latest-heading" className="text-2xl">Latest additions</h2>
          <Link href="/shop?sort=newest" className="text-sm font-semibold text-burgundy hover:underline">
            See more →
          </Link>
        </div>
        <div className="mt-6">
          <ProductGrid products={latest.items} wishlist={wish} signedIn={signedIn} />
        </div>
      </section>

      {/* Support */}
      <section className="container-x pt-10" aria-labelledby="support-heading">
        <div className="grid gap-6 rounded-3xl bg-gradient-to-br from-burgundy-50 to-lime-50 p-8 md:grid-cols-3 md:p-10">
          <div className="md:col-span-1">
            <h2 id="support-heading" className="text-2xl text-burgundy">We&apos;re here to help</h2>
            <p className="mt-2 text-sm text-grey-600">Questions about a product, an order or delivery? Our Abuja team will get back to you.</p>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-1 h-5 w-5 text-burgundy" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Email</p>
              <a href={`mailto:${settings.supportEmail}`} className="break-all text-sm text-burgundy hover:underline">
                {settings.supportEmail}
              </a>
              <p className="mt-2 text-sm">
                <Link href="/contact" className="font-semibold text-burgundy hover:underline">Send us a message →</Link>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 h-5 w-5 text-burgundy" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Office</p>
              <p className="text-sm text-grey-700">{settings.addressLines.join(", ")}</p>
              <p className="mt-2 text-sm">
                <Link href="/track-order" className="font-semibold text-burgundy hover:underline">Track an order →</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
