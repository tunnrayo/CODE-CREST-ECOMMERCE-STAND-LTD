"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Notice, StatusPill } from "@/components/ui";
import { formatDate, formatKobo, ORDER_STATUS_LABEL } from "@/lib/format";

type Result = {
  reference: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  totalKobo: number;
  shippingConfirmed: boolean;
  itemCount: number;
  history: { toStatus: string; note: string | null; createdAt: string }[];
  shipments: { carrier: string; trackingNumber: string | null; trackingUrl: string | null; status: string; carrierDataVerified: boolean }[];
};

export function TrackOrderForm({ initialReference }: { initialReference: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  return (
    <div className="space-y-6">
      <form
        className="card grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        data-testid="track-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          setResult(null);
          const res = await fetch("/api/v1/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: fd.get("reference"), email: fd.get("email") }) });
          const json = await res.json().catch(() => ({}));
          setBusy(false);
          if (res.ok) setResult(json.data);
          else setError(json?.error?.message ?? "Order not found.");
        }}
      >
        <div>
          <label htmlFor="t-ref" className="label">Order reference</label>
          <input id="t-ref" name="reference" defaultValue={initialReference} placeholder="CC-YYMMDD-XXXXXX" className="input uppercase" required />
        </div>
        <div>
          <label htmlFor="t-email" className="label">Email address</label>
          <input id="t-email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <button className="btn-burgundy h-[42px]" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Track
        </button>
      </form>
      {error && <Notice kind="error">{error}</Notice>}
      {result && (
        <div className="card p-6" data-testid="track-result">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl">Order {result.reference}</h2>
            <div className="flex gap-2"><StatusPill status={result.status} /><StatusPill status={result.paymentStatus} /></div>
          </div>
          <p className="mt-1 text-sm text-grey-600">
            {result.itemCount} item{result.itemCount === 1 ? "" : "s"} · {formatKobo(result.totalKobo)}
            {result.shippingConfirmed ? "" : " + delivery (to be confirmed)"} · placed {formatDate(result.createdAt)}
          </p>
          <ol className="mt-5 space-y-3 border-l-2 border-grey-200 pl-4">
            {result.history.map((h, i) => (
              <li key={i} className="relative text-sm">
                <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-burgundy ring-4 ring-white" aria-hidden />
                <p className="font-medium">{ORDER_STATUS_LABEL[h.toStatus] ?? h.toStatus}</p>
                {h.note && <p className="text-grey-600">{h.note}</p>}
                <p className="text-xs text-grey-400">{formatDate(h.createdAt, true)}</p>
              </li>
            ))}
          </ol>
          {result.shipments.map((s, i) => (
            <p key={i} className="mt-4 text-sm">
              Courier: <strong>{s.carrier}</strong>
              {s.trackingNumber && <> · Tracking no. {s.trackingNumber}</>}
              {s.trackingUrl && <> · <a href={s.trackingUrl} className="text-burgundy underline" target="_blank" rel="noopener noreferrer">carrier tracking</a></>}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
