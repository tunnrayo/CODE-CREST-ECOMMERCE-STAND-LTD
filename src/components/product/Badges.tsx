import { BadgeCheck, Clock3 } from "lucide-react";

export function VerificationBadge({ status, compact }: { status: string; compact?: boolean }) {
  if (status === "SUPPLIER_VERIFIED") {
    return (
      <span className="badge bg-lime-100 text-lime-800" title="Price and product details confirmed with a supplier">
        <BadgeCheck className="h-3 w-3" /> Verified
      </span>
    );
  }
  return (
    <span className="badge bg-grey-100 text-grey-600" title="Price, specifications and availability will be confirmed before payment">
      <Clock3 className="h-3 w-3" /> {compact ? "To be confirmed" : "Price & availability to be confirmed"}
    </span>
  );
}

export function StockBadge({ status, compact }: { status: string; compact?: boolean }) {
  if (status === "IN_STOCK") return <span className="badge bg-lime-100 text-lime-800">In stock</span>;
  if (status === "LOW_STOCK") return <span className="badge bg-amber-100 text-amber-800">Low stock</span>;
  if (status === "OUT_OF_STOCK") return <span className="badge bg-red-100 text-red-800">Out of stock</span>;
  return compact ? null : <span className="badge bg-grey-100 text-grey-600">Availability to be confirmed</span>;
}
