import Link from "next/link";
import { AdminPage, type SP } from "@/components/admin/AdminUI";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdminPage } from "@/server/auth/current";
import { listCategories } from "@/server/services/catalogue";
import { createProductAction } from "../../../actions";

export const metadata = { title: "New product" };

export default async function NewProduct({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("catalogue:write");
  const [sp, cats] = await Promise.all([searchParams, listCategories({ includeInactive: true })]);
  return (
    <AdminPage title="New product" searchParams={sp} actions={<Link href="/admin/products" className="btn-ghost btn-sm">← Products</Link>}>
      <ProductForm action={createProductAction} categories={cats} backHref="/admin/products/new" product={{ status: "DRAFT" }} />
    </AdminPage>
  );
}
