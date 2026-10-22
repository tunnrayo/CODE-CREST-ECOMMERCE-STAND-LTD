import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { SimpleMarkdown } from "@/components/ui/SimpleMarkdown";
import { getPolicy, type PolicySlug } from "@/server/services/content";
import { formatDate } from "@/lib/format";

export async function PolicyPage({ slug }: { slug: PolicySlug }) {
  const p = await getPolicy(slug);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.title} subtitle={`Last updated ${formatDate(p.updatedAt)}`}>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: p.title }]} />
      </PageHeader>
      <article className="container-x max-w-3xl py-10">
        {!p.isReviewed && <p className="mb-6 rounded-xl bg-grey-50 px-4 py-3 text-xs text-grey-500">This policy is being finalised ahead of our full launch and may be updated.</p>}
        <SimpleMarkdown text={p.body} />
      </article>
    </>
  );
}
