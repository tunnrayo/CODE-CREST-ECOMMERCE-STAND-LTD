import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueView } from "@/components/product/CatalogueView";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { getCategoryBySlug } from "@/server/services/catalogue";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategoryBySlug(slug);
  if (!c) return { title: "Category not found" };
  return { title: c.name, description: c.description ?? `Shop ${c.name} at Code Crest.`, alternates: { canonical: `/category/${c.slug}` }, openGraph: { title: `${c.name} | Code Crest` } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = await getCategoryBySlug(slug);
  if (!c) notFound();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={c.name} subtitle={c.description ?? undefined}>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Categories", href: "/categories" }, { label: c.name }]} />
      </PageHeader>
      <Suspense>
        <CatalogueView basePath={`/category/${c.slug}`} searchParams={sp} fixedCategory={c.slug} />
      </Suspense>
    </>
  );
}
