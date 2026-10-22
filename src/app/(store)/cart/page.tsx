import type { Metadata } from "next";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { CartPageClient } from "./CartPageClient";

export const metadata: Metadata = { title: "Shopping cart", robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <PageHeader title="Shopping cart">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      </PageHeader>
      <CartPageClient />
    </>
  );
}
