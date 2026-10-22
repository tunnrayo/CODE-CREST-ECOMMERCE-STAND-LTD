import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { requireAdminPage } from "@/server/auth/current";
import { can } from "@/server/auth/core";
import { getSettings, integrationStatus } from "@/server/services/settings";
import { Logo } from "@/components/brand/Logo";
import { adminLogoutAction } from "../actions";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Code Crest Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  const settings = await getSettings();
  const integ = integrationStatus();
  const items = [
    { href: "/admin", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/products", label: "Products", icon: "products" },
    { href: "/admin/categories", label: "Categories", icon: "categories" },
    { href: "/admin/images", label: "Images", icon: "images" },
    { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
    { href: "/admin/orders", label: "Orders", icon: "orders" },
    ...(can(user.role, "payments:read") ? [{ href: "/admin/payments", label: "Payments", icon: "payments" }] : []),
    { href: "/admin/suppliers", label: "Suppliers", icon: "suppliers" },
    { href: "/admin/messages", label: "Messages", icon: "messages" },
    ...(can(user.role, "settings:write") ? [{ href: "/admin/settings", label: "Store settings", icon: "settings" }] : []),
    ...(can(user.role, "users:manage") ? [{ href: "/admin/users", label: "Team & users", icon: "users" }] : []),
    ...(can(user.role, "audit:read") ? [{ href: "/admin/audit", label: "Audit log", icon: "audit" }] : []),
  ];
  return (
    <div className="min-h-screen bg-grey-50 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="bg-burgundy-800 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/admin"><Logo onDark compact /></Link>
        </div>
        <AdminNav items={items} />
        <div className="hidden px-5 py-6 text-xs text-white/60 lg:block">
          <p>Order mode: <strong className="text-lime">{settings.orderMode}</strong></p>
          <p className="mt-1">Payments: <strong className={integ.payments.configured ? "text-lime" : "text-amber-300"}>{integ.payments.configured ? `Paystack ${integ.payments.mode}` : "not configured"}</strong></p>
          <p className="mt-1">Email: <strong className={integ.email.configured ? "text-lime" : "text-amber-300"}>{integ.email.configured ? "configured" : "not configured"}</strong></p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-grey-200 bg-white px-4 py-3 sm:px-8">
          <p className="text-sm text-grey-600">
            Signed in as <strong className="text-grey-900">{user.name}</strong> <span className="badge ml-1 bg-burgundy-50 text-burgundy">{user.role}</span>
          </p>
          <div className="flex items-center gap-2">
            <Link href="/" target="_blank" className="btn-ghost btn-sm"><ExternalLink className="h-3.5 w-3.5" /> View store</Link>
            <form action={adminLogoutAction}>
              <button className="btn-outline btn-sm" data-testid="admin-logout"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
