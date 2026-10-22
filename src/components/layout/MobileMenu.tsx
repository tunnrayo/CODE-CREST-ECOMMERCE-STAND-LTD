"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "../brand/Logo";

export function MobileMenu({ categories, userName }: { categories: { slug: string; name: string }[]; userName: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const item = "block rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-burgundy-50 hover:text-burgundy";
  return (
    <>
      <button type="button" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10 md:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} data-testid="mobile-menu-button">
        <Menu className="h-6 w-6" />
      </button>
      <div className={clsx("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
        <div className={clsx("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <nav className={clsx("absolute left-0 top-0 h-full w-[85%] max-w-sm overflow-y-auto bg-white text-grey-900 shadow-2xl transition-transform", open ? "translate-x-0" : "-translate-x-full")} aria-label="Mobile">
          <div className="flex items-center justify-between bg-burgundy px-4 py-4">
            <Logo onDark compact />
            <button type="button" className="rounded-full p-2 text-white hover:bg-white/10" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-3">
            <Link href="/" className={item}>Home</Link>
            <Link href="/shop" className={item}>Shop All</Link>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-grey-500">Categories</p>
            {categories.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className={item}>
                {c.name}
              </Link>
            ))}
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-grey-500">Help & account</p>
            <Link href={userName ? "/account" : "/account/login"} className={item}>{userName ? "My account" : "Sign in / Register"}</Link>
            <Link href="/wishlist" className={item}>Wishlist</Link>
            <Link href="/track-order" className={item}>Track order</Link>
            <Link href="/about" className={item}>About us</Link>
            <Link href="/contact" className={item}>Contact</Link>
            <Link href="/faq" className={item}>FAQ</Link>
          </div>
        </nav>
      </div>
    </>
  );
}
