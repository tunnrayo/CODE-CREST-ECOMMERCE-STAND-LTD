"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Boxes, ClipboardList, CreditCard, FolderTree, Images, LayoutDashboard, Mail, Menu, Package, Settings, ShieldCheck, Truck, Users } from "lucide-react";

const ICONS = { dashboard: LayoutDashboard, products: Package, categories: FolderTree, images: Images, inventory: Boxes, orders: ClipboardList, payments: CreditCard, suppliers: Truck, messages: Mail, settings: Settings, users: Users, audit: ShieldCheck } as const;

export function AdminNav({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="mx-5 mb-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm lg:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Menu className="h-4 w-4" /> Menu
      </button>
      <nav className={clsx("space-y-0.5 px-3 pb-4 lg:block", open ? "block" : "hidden")} aria-label="Admin">
        {items.map((it) => {
          const Icon = ICONS[it.icon as keyof typeof ICONS] ?? Package;
          const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-lime text-burgundy-800" : "text-white/85 hover:bg-white/10")} aria-current={active ? "page" : undefined}>
              <Icon className="h-4 w-4" /> {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
