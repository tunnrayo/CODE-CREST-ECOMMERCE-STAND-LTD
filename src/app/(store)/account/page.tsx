import type { Metadata } from "next";
import Link from "next/link";
import { Heart, LogOut, Package, Trash2 } from "lucide-react";
import { Breadcrumbs, PageHeader, StatusPill } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/current";
import { can } from "@/server/auth/core";
import { listAddresses } from "@/server/services/accounts";
import { listOrdersForUser } from "@/server/services/orders";
import { NIGERIAN_STATES } from "@/server/services/shipping";
import { formatDate, formatKobo } from "@/lib/format";
import { deleteAddressAction, logoutAction } from "./actions";
import { AddressForm, PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireCustomerPage("/account");
  const [orders, addresses] = await Promise.all([listOrdersForUser(user.id), listAddresses(user.id)]);
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} subtitle={user.email}>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My account" }]} />
      </PageHeader>
      <div className="container-x grid gap-8 py-8 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-1 text-sm" aria-label="Account">
          <Link href="/account" className="flex items-center gap-2 rounded-xl bg-burgundy-50 px-3 py-2.5 font-semibold text-burgundy">Overview</Link>
          <Link href="/account/orders" className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-grey-100"><Package className="h-4 w-4" /> Order history</Link>
          <Link href="/wishlist" className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-grey-100"><Heart className="h-4 w-4" /> Wishlist</Link>
          {can(user.role, "admin:access") && <Link href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold text-burgundy hover:bg-grey-100">Admin portal →</Link>}
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-grey-100" data-testid="logout"><LogOut className="h-4 w-4" /> Sign out</button>
          </form>
        </nav>
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">Recent orders</h2>
              <Link href="/account/orders" className="text-sm font-semibold text-burgundy hover:underline">View all</Link>
            </div>
            {orders.length === 0 ? (
              <p className="mt-3 text-sm text-grey-600">You haven&apos;t placed any orders yet. <Link href="/shop" className="font-semibold text-burgundy">Start shopping →</Link></p>
            ) : (
              <ul className="mt-3 divide-y divide-grey-100">
                {orders.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <Link href={`/order/${o.reference}`} className="font-semibold text-burgundy hover:underline">{o.reference}</Link>
                    <span className="text-grey-500">{formatDate(o.createdAt)}</span>
                    <StatusPill status={o.status} />
                    <span className="font-medium">{formatKobo(o.totalKobo)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="card p-6">
              <h2 className="text-lg">Profile</h2>
              <div className="mt-4"><ProfileForm name={user.name} phone={user.phone} /></div>
            </section>
            <section className="card p-6">
              <h2 className="text-lg">Change password</h2>
              <div className="mt-4"><PasswordForm /></div>
            </section>
          </div>
          <section className="card p-6">
            <h2 className="text-lg">Saved addresses</h2>
            {addresses.length > 0 && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <li key={a.id} className="relative rounded-xl border border-grey-200 p-4 text-sm">
                    {a.isDefault && <span className="badge mb-2 bg-lime-100 text-lime-800">Default</span>}
                    <p className="font-medium">{a.fullName}</p>
                    <p className="text-grey-600">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state}</p>
                    <p className="text-grey-600">{a.phone}</p>
                    <form action={deleteAddressAction} className="absolute right-2 top-2">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-full p-2 text-grey-400 hover:bg-grey-100 hover:text-red-700" aria-label="Delete address"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-burgundy">+ Add an address</summary>
              <div className="mt-4"><AddressForm states={[...NIGERIAN_STATES]} /></div>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
