import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { CategoryIcon } from "@/components/product/CategoryIcon";
import { listCategories, listProducts } from "@/server/services/catalogue";

export const metadata: Metadata = { title: "Product categories", description: "Shop Code Crest by category.", alternates: { canonical: "/categories" } };

export default async function CategoriesPage() {
  const cats = await listCategories();
  const previews = await Promise.all(cats.map((c) => listProducts({ category: c.slug, perPage: 3, featured: undefined })));
  return (
    <>
      <PageHeader title="Product categories" subtitle="Seven departments of everyday essentials.">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Categories" }]} />
      </PageHeader>
      <div className="container-x grid gap-5 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c, i) => (
          <Link key={c.slug} href={`/category/${c.slug}`} className="group overflow-hidden rounded-3xl border border-grey-200 bg-white transition hover:-translate-y-0.5 hover:shadow-card" data-testid="category-tile">
            <div className="flex items-center gap-4 bg-burgundy p-5 text-white">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-burgundy-800">
                <CategoryIcon slug={c.slug} className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white">{c.name}</h2>
                <p className="text-xs text-white/75">{c.productCount} products</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              {previews[i].items.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-grey-100">
                  <Image src={p.image.url} alt={p.image.alt} fill sizes="120px" className="object-cover" />
                </div>
              ))}
            </div>
            <p className="px-5 pb-5 text-sm text-grey-600">{c.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
