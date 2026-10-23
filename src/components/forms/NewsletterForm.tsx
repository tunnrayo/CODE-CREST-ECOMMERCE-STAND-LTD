"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function NewsletterForm() {
  const [state, setState] = useState<{ status: "idle" | "busy" | "ok" | "error"; message?: string }>({ status: "idle" });
  return (
    <form
      className="w-full"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setState({ status: "busy" });
        const res = await fetch("/api/v1/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: fd.get("email"), consent: fd.get("consent") === "on" }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setState({ status: "ok", message: "Thank you — you're subscribed." });
          (e.target as HTMLFormElement).reset();
        } else setState({ status: "error", message: json?.error?.details?.fieldErrors?.consent?.[0] ?? json?.error?.message ?? "Could not subscribe." });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">Email address</label>
        <input id="newsletter-email" name="email" type="email" required placeholder="Your email address" className="h-12 w-full min-w-0 flex-1 rounded-full border-0 px-5 text-sm text-grey-900 focus:outline-none focus:ring-2 focus:ring-lime" />
        <button className="btn-primary h-12 shrink-0 px-7" disabled={state.status === "busy"}>
          {state.status === "busy" && <Loader2 className="h-4 w-4 animate-spin" />} Subscribe
        </button>
      </div>
      <label className="mt-2 flex items-start gap-2 text-xs text-white/80">
        <input type="checkbox" name="consent" className="mt-0.5 accent-lime" required /> I agree to receive marketing emails from Code Crest.
      </label>
      {state.message && (
        <p className={`mt-2 text-sm ${state.status === "ok" ? "text-lime" : "text-red-200"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
