import type { Metadata } from "next";
import { PolicyPage } from "@/components/ui/PolicyPage";

export const metadata: Metadata = { title: "Returns & Refund Policy", alternates: { canonical: "/returns-policy" } };

export default function Page() {
  return <PolicyPage slug="returns-policy" />;
}
