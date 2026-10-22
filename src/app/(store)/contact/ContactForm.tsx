"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Notice } from "@/components/ui";

export function ContactForm({ defaultSubject }: { defaultSubject?: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  if (done) return <Notice kind="success" title="Message received">Thank you — your message has been saved and our team will reply to your email address.</Notice>;
  const err = (k: string) => fe[k] && <p className="field-error">{fe[k]}</p>;
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      data-testid="contact-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        setFe({});
        const res = await fetch("/api/v1/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd)) });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (res.ok) setDone(true);
        else {
          setError(json?.error?.message ?? "Could not send your message.");
          const f = json?.error?.details?.fieldErrors as Record<string, string[]> | undefined;
          if (f) setFe(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v[0]])));
        }
      }}
    >
      {error && <div className="sm:col-span-2"><Notice kind="error">{error}</Notice></div>}
      <div><label className="label" htmlFor="c-name">Your name</label><input id="c-name" name="name" className="input" required autoComplete="name" />{err("name")}</div>
      <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" className="input" required autoComplete="email" />{err("email")}</div>
      <div className="sm:col-span-2"><label className="label" htmlFor="c-subject">Subject</label><input id="c-subject" name="subject" defaultValue={defaultSubject} className="input" required />{err("subject")}</div>
      <div className="sm:col-span-2"><label className="label" htmlFor="c-message">Message</label><textarea id="c-message" name="message" rows={6} className="input" required minLength={10} maxLength={4000} />{err("message")}</div>
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="sm:col-span-2"><button className="btn-burgundy" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send message</button></div>
    </form>
  );
}
