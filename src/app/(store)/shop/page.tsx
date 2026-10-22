import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogueView } from "@/components/product/CatalogueView";
import { Breadcrumbs, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Shop all products",
  description: "Browse every Code Crest product — electronics, home & kitchen, fashion, beauty, office, kids and outdoor essentials.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Shop all products" subtitle="Search, filter and sort the full Code Crest catalogue.">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
      </PageHeader>
      <Suspense>
        <CatalogueView basePath="/shop" searchParams={sp} />
      </Suspense>
    </>
  );
}
