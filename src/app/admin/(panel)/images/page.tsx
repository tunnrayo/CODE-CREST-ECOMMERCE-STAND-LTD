import Link from "next/link";
import Image from "next/image";
import { AdminPage, Stat, type SP } from "@/components/admin/AdminUI";
import { StatusPill } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/current";
import { getImageReport } from "@/server/services/admin-catalogue";

export const metadata = { title: "Image verification" };

export default async function ImagesReport({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("catalogue:write");
  const [sp, { rows, summary }] = await Promise.all([searchParams, getImageReport()]);
  const filter = sp.filter ?? "all";
  const shown = rows.filter((r) => (filter === "needs" ? !r.image || r.image.verificationStatus !== "VERIFIED" : true));
  return (
    <AdminPage title="Image verification report" subtitle="Every product image, where it came from, and whether it is cleared for use." searchParams={sp}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Products" value={summary.total} />
        <Stat label="Verified images" value={summary.verified} />
        <Stat label="Code Crest illustrations" value={summary.illustration} hint="Placeholders until real photos are cleared" />
        <Stat label="Need a photo" value={summary.needsImage} />
      </div>
      <div className="flex gap-2 text-sm">
        <Link href="/admin/images" className={filter === "all" ? "font-bold text-burgundy" : "text-grey-600"}>All</Link>·
        <Link href="/admin/images?filter=needs" className={filter === "needs" ? "font-bold text-burgundy" : "text-grey-600"}>Not yet verified</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-grey-200 bg-white">
        <table className="table-admin">
          <thead><tr><th></th><th>SKU</th><th>Product</th><th>Source</th><th>Permission</th><th>Verification</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.productId}>
                <td>{r.image ? <Image src={r.image.url} alt="" width={40} height={40} className="rounded-lg" /> : <span className="text-xs text-grey-400">none</span>}</td>
                <td className="whitespace-nowrap">{r.sku}</td>
                <td><Link href={`/admin/products/${r.productId}`} className="font-medium text-burgundy hover:underline">{r.name}</Link></td>
                <td className="text-xs">{r.image ? `${r.image.sourceType.replace(/_/g, " ").toLowerCase()}${r.image.sourceName ? ` · ${r.image.sourceName}` : ""}` : "—"}</td>
                <td>{r.image ? <StatusPill status={r.image.licenseStatus} /> : "—"}</td>
                <td>{r.image ? <StatusPill status={r.image.verificationStatus} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
