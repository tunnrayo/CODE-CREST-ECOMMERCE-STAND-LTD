import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, EmptyState, PageHeader } from "@/components/ui";
import { ProductGrid } from "@/components/product/ProductCard";
import { requireCustomerPage } from "@/server/auth/current";
import { wishlistFor } from "@/server/services/accounts";
import { listProducts } from "@/server/services/catalogue";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const user = await requireCustomerPage("/wishlist");
  const ids = (await wishlistFor(user.id)).map((w) => w.productId);
  const all = ids.length ? await listProducts({ perPage: 60 }) : null;
  // Fetch remaining pages only if needed (catalogue is small); preserve wishlist order.
  let items = all?.items ?? [];
  if (all && all.pageCount > 1) {
    for (let p = 2; p <= all.pageCount; p++) items = items.concat((await listProducts({ perPage: 60, page: p })).items);
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  const products = ids.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <>
      <PageHeader title="Your wishlist" subtitle="Products you've saved for later.">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />
      </PageHeader>
      <div className="container-x py-8">
        {products.length ? (
          <ProductGrid products={products} wishlist={new Set(ids)} signedIn />
        ) : (
          <EmptyState title="Your wishlist is empty" message="Tap the heart on any product to save it here." action={<Link href="/shop" className="btn-burgundy">Browse products</Link>} />
        )}
      </div>
    </>
  );
}
