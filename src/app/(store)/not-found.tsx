import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-x py-16">
      <EmptyState title="Page not found" message="The page you're looking for doesn't exist or is no longer available." action={<div className="flex gap-2"><Link href="/" className="btn-burgundy">Go home</Link><Link href="/shop" className="btn-outline">Shop all</Link></div>} />
    </div>
  );
}
