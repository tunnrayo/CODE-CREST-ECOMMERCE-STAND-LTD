const ngnWhole = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const ngnFrac = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format integer kobo as Naira, e.g. 1800000 → "₦18,000". */
export function formatKobo(kobo: number | null | undefined, currency = "NGN"): string {
  if (kobo == null) return "—";
  if (currency !== "NGN") {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(kobo / 100);
  }
  return (kobo % 100 === 0 ? ngnWhole : ngnFrac).format(kobo / 100).replace("NGN", "₦").replace(/\s/g, "");
}

/** Parse "18,000" / "₦18,000.50" from an admin form into kobo. Returns null for blank. */
export function parseNairaInput(v: FormDataEntryValue | string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[₦,\s]/g, "");
  if (s === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${v}`);
  return Math.round(Number(s) * 100);
}

export function formatDate(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Africa/Lagos",
  });
}

export function effectivePriceKobo(p: { retailPriceKobo: number; salePriceKobo: number | null }, variantOverride?: number | null): number {
  if (variantOverride != null) return variantOverride;
  return p.salePriceKobo != null && p.salePriceKobo < p.retailPriceKobo ? p.salePriceKobo : p.retailPriceKobo;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Unpaid",
  PENDING: "Payment pending",
  PAID: "Paid (verified)",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};
