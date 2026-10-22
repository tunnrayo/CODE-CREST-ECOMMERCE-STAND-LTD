import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/current";
import { currentCartId } from "@/server/cart-context";
import { getCartView } from "@/server/services/cart";
import { listAddresses } from "@/server/services/accounts";
import { getSettings, integrationStatus } from "@/server/services/settings";
import { NIGERIAN_STATES } from "@/server/services/shipping";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const cart = await getCartView(await currentCartId(false));
  const addresses = user ? await listAddresses(user.id) : [];
  const def = addresses[0];
  return (
    <>
      <PageHeader title="Checkout">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      </PageHeader>
      {cart.lines.length === 0 ? (
        <div className="container-x py-10">
          <EmptyState title="Your cart is empty" message="Add some products before checking out." action={<Link href="/shop" className="btn-burgundy">Shop now</Link>} />
        </div>
      ) : (
        <CheckoutForm
          cart={cart}
          states={[...NIGERIAN_STATES]}
          mode={settings.orderMode}
          paymentsConfigured={integrationStatus().payments.configured}
          signedIn={!!user}
          defaults={{
            email: user?.email ?? "",
            fullName: def?.fullName ?? user?.name ?? "",
            phone: def?.phone ?? user?.phone ?? "",
            line1: def?.line1 ?? "",
            line2: def?.line2 ?? "",
            city: def?.city ?? "",
            state: def?.state ?? "",
          }}
        />
      )}
    </>
  );
}
