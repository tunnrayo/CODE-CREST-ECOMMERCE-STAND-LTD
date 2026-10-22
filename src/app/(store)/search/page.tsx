import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogueView } from "@/components/product/CatalogueView";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { SearchForm } from "@/components/layout/Header";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search: ${q.slice(0, 60)}` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  return (
    <>
      <PageHeader title={q ? `Search results` : "Search products"} subtitle={q ? undefined : "Type a product name, category or keyword."}>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      </PageHeader>
      <div className="container-x pt-6">
        <div className="max-w-xl rounded-full bg-burgundy p-1">
          <SearchForm defaultValue={q} id="search-page-input" />
        </div>
      </div>
      <Suspense>
        <CatalogueView basePath="/search" searchParams={sp} />
      </Suspense>
    </>
  );
}
