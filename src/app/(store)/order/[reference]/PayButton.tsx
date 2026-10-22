"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";

export function PayButton({ reference, token }: { reference: string; token: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn-burgundy"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/v1/orders/${encodeURIComponent(reference)}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.data?.authorizationUrl) window.location.href = json.data.authorizationUrl;
          else {
            setBusy(false);
            setError(json?.error?.message ?? "Could not start payment.");
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Pay securely with Paystack
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
