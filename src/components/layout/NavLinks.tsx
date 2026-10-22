"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop All" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/track-order", label: "Track Order" },
  { href: "/faq", label: "FAQ" },
];

export function NavLinks({ categories }: { categories: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const linkCls = (on: boolean) => clsx("relative inline-flex h-11 items-center px-3 text-sm font-medium transition-colors hover:text-lime", on ? "text-lime" : "text-white/90");

  return (
    <nav className="container-x flex items-center" aria-label="Main">
      <Link href="/" className={linkCls(active("/"))} aria-current={active("/") ? "page" : undefined}>
        Home
      </Link>
      <Link href="/shop" className={linkCls(active("/shop"))} aria-current={active("/shop") ? "page" : undefined}>
        Shop All
      </Link>
      <div className="relative" ref={ref}>
        <button type="button" className={linkCls(pathname.startsWith("/categor"))} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
          Categories <ChevronDown className={clsx("ml-1 h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl bg-white p-2 text-grey-900 shadow-xl ring-1 ring-black/5">
            {categories.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-burgundy-50 hover:text-burgundy">
                {c.name}
              </Link>
            ))}
            <Link href="/categories" className="mt-1 block rounded-xl bg-grey-50 px-3 py-2.5 text-sm font-semibold text-burgundy hover:bg-burgundy-50">
              View all categories →
            </Link>
          </div>
        )}
      </div>
      {LINKS.slice(2).map((l) => (
        <Link key={l.href} href={l.href} className={linkCls(active(l.href))} aria-current={active(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
