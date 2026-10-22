import type { Metadata } from "next";
import { PolicyPage } from "@/components/ui/PolicyPage";

export const metadata: Metadata = { title: "Shipping & Delivery Policy", alternates: { canonical: "/shipping-policy" } };

export default function Page() {
  return <PolicyPage slug="shipping-policy" />;
}
