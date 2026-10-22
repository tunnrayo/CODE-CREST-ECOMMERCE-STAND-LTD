"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Notice } from "@/components/ui";
import { ProductImage } from "@/components/product/ProductImage";
import { useCart, type Cart } from "@/components/cart/CartProvider";
import { formatKobo } from "@/lib/format";

type Option = { id: string; name: string; description: string | null; feeKobo: number | null; feeConfirmed: boolean; freeOverKobo: number | null; estimatedDeliveryText: string | null };
type Defaults = { email: string; fullName: string; phone: string; line1: string; line2: string; city: string; state: string };

export function CheckoutForm({ cart, states, mode, paymentsConfigured, signedIn, defaults }: { cart: Cart; states: string[]; mode: "REQUEST" | "LIVE"; paymentsConfigured: boolean; signedIn: boolean; defaults: Defaults }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [state, setState] = useState(defaults.state);
  const [options, setOptions] = useState<Option[]>([]);
  const [methodId, setMethodId] = useState<string>("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ message: string; items?: { name: string; problem: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) {
      setOptions([]);
      return;
    }
    setLoadingOptions(true);
    fetch(`/api/v1/shipping/options?country=NG&state=${encodeURIComponent(state)}`)
      .then((r) => r.json())
      .then((j) => {
        const opts: Option[] = j.data ?? [];
        setOptions(opts);
        setMethodId((m) => (opts.some((o) => o.id === m) ? m : (opts[0]?.id ?? "")));
      })
      .finally(() => setLoadingOptions(false));
  }, [state]);

  const option = options.find((o) => o.id === methodId);
  const fee = option && option.feeConfirmed && option.feeKobo != null ? (option.freeOverKobo != null && cart.subtotalKobo >= option.freeOverKobo ? 0 : option.feeKobo) : null;
  const total = cart.subtotalKobo + (fee ?? 0);
  const liveBlocked = mode === "LIVE" && !paymentsConfigured;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      email: fd.get("email"),
      fullName: fd.get("fullName"),
      phone: fd.get("phone"),
      line1: fd.get("line1"),
      line2: fd.get("line2") || null,
      city: fd.get("city"),
      state: fd.get("state"),
      country: "NG",
      shippingMethodId: methodId,
      note: fd.get("note") || null,
      acceptTerms: fd.get("acceptTerms") === "on",
    };
    setBusy(true);
    setErrors({});
    setFormError(null);
    const res = await fetch("/api/v1/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      const fe = json?.error?.details?.fieldErrors as Record<string, string[]> | undefined;
      if (fe) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]])));
      setFormError({ message: json?.error?.message ?? "We could not place your order.", items: Array.isArray(json?.error?.details) ? json.error.details : undefined });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    await refresh();
    const { reference, accessToken, payment } = json.data as { reference: string; accessToken: string; payment?: { authorizationUrl: string } | null };
    if (payment?.authorizationUrl) {
      window.location.href = payment.authorizationUrl;
      return;
    }
    router.push(`/order/${reference}?token=${encodeURIComponent(accessToken)}&placed=1`);
  }

  const field = (name: keyof Defaults | "note", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`co-${name}`} className="label">{label}</label>
      <input id={`co-${name}`} name={name} defaultValue={name === "note" ? "" : defaults[name as keyof Defaults]} className="input" aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `co-${name}-err` : undefined} {...props} />
      {errors[name] && <p id={`co-${name}-err`} className="field-error">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="container-x grid gap-8 py-8 lg:grid-cols-[1fr_380px]" noValidate data-testid="checkout-form">
      <div className="space-y-6">
        {formError && (
          <Notice kind="error" title={formError.message}>
            {formError.items && (
              <ul className="mt-1 list-disc pl-4">
                {formError.items.map((i) => <li key={i.name}>{i.name}: {i.problem}</li>)}
              </ul>
            )}
          </Notice>
        )}
        {mode === "REQUEST" && (
          <Notice kind="info" title="How ordering works during pre-launch">
            Submitting this form sends us an <strong>order request</strong>. No payment is taken now. We will confirm availability, final price and the delivery fee with you, then send a secure payment link.
          </Notice>
        )}
        {liveBlocked && <Notice kind="warning" title="Online payment is temporarily unavailable">Please try again later or contact us.</Notice>}

        <section className="card p-6">
          <h2 className="text-lg">Contact details</h2>
          {!signedIn && (
            <p className="mt-1 text-sm text-grey-600">
              Have an account? <Link href="/account/login?next=/checkout" className="font-semibold text-burgundy hover:underline">Sign in</Link> for faster checkout and order history.
            </p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {field("fullName", "Full name", { autoComplete: "name", required: true })}
            {field("phone", "Phone number", { autoComplete: "tel", type: "tel", required: true, placeholder: "e.g. 0803 000 0000" })}
            <div className="sm:col-span-2">{field("email", "Email address", { autoComplete: "email", type: "email", required: true })}</div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg">Delivery address</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("line1", "Street address", { autoComplete: "address-line1", required: true })}</div>
            <div className="sm:col-span-2">{field("line2", "Apartment, landmark (optional)", { autoComplete: "address-line2" })}</div>
            {field("city", "City / Town", { autoComplete: "address-level2", required: true })}
            <div>
              <label htmlFor="co-state" className="label">State</label>
              <select id="co-state" name="state" className="input" value={state} onChange={(e) => setState(e.target.value)} required aria-invalid={!!errors.state}>
                <option value="">Choose a state</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <p className="field-error">{errors.state}</p>}
            </div>
            <div className="sm:col-span-2">
              <p className="label">Country</p>
              <p className="text-sm text-grey-700">Nigeria</p>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg">Delivery option</h2>
          {!state ? (
            <p className="mt-2 text-sm text-grey-600">Choose your state to see delivery options.</p>
          ) : loadingOptions ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-grey-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading options…</p>
          ) : options.length === 0 ? (
            <Notice kind="warning" className="mt-3">We don&apos;t have a delivery option set up for {state} yet. Please contact us.</Notice>
          ) : (
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Delivery option">
              {options.map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${methodId === o.id ? "border-burgundy bg-burgundy-50" : "border-grey-200"}`}>
                  <input type="radio" name="shippingMethodId" value={o.id} checked={methodId === o.id} onChange={() => setMethodId(o.id)} className="mt-1 accent-burgundy" />
                  <span className="flex-1">
                    <span className="flex justify-between gap-2 font-medium">
                      <span>{o.name}</span>
                      <span className="text-burgundy">{o.feeConfirmed && o.feeKobo != null ? formatKobo(o.feeKobo) : "Fee to be confirmed"}</span>
                    </span>
                    {o.description && <span className="mt-0.5 block text-sm text-grey-600">{o.description}</span>}
                    {o.estimatedDeliveryText && <span className="mt-0.5 block text-xs text-grey-500">Estimated: {o.estimatedDeliveryText}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.shippingMethodId && <p className="field-error">{errors.shippingMethodId}</p>}
          <div className="mt-4">
            <label htmlFor="co-note" className="label">Order note (optional)</label>
            <textarea id="co-note" name="note" rows={3} maxLength={500} className="input" placeholder="Anything we should know about your order or delivery?" />
          </div>
        </section>
      </div>

      <aside className="card h-fit p-6 lg:sticky lg:top-40">
        <h2 className="text-lg">Your order</h2>
        <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex items-center gap-3 text-sm">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-grey-100">
                <ProductImage src={l.imageUrl} alt={l.imageAlt} sizes="48px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1">{l.name}</span>
                <span className="text-xs text-grey-500">Qty {l.quantity}</span>
              </span>
              <span className="font-medium">{formatKobo(l.lineTotalKobo)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-grey-200 pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatKobo(cart.subtotalKobo)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{option ? (fee != null ? formatKobo(fee) : "To be confirmed") : "—"}</dd></div>
        </dl>
        <div className="mt-3 flex justify-between border-t border-grey-200 pt-3 text-base font-semibold">
          <span>Total</span>
          <span className="text-burgundy" data-testid="checkout-total">{formatKobo(total)}{option && fee == null ? " + delivery" : ""}</span>
        </div>
        <label className="mt-5 flex items-start gap-2 text-sm">
          <input type="checkbox" name="acceptTerms" className="mt-1 accent-burgundy" />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="font-medium text-burgundy underline">Terms</Link>, <Link href="/returns-policy" target="_blank" className="font-medium text-burgundy underline">Returns policy</Link> and <Link href="/privacy-policy" target="_blank" className="font-medium text-burgundy underline">Privacy policy</Link>.
          </span>
        </label>
        {errors.acceptTerms && <p className="field-error">{errors.acceptTerms}</p>}
        <button className="btn-primary mt-5 w-full py-3 text-base" disabled={busy || liveBlocked || !methodId} data-testid="place-order">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {mode === "REQUEST" ? "Submit order request" : "Continue to secure payment"}
        </button>
        <p className="mt-3 text-center text-xs text-grey-500">{mode === "REQUEST" ? "No payment is taken at this step." : "You will be redirected to Paystack to pay securely."}</p>
      </aside>
    </form>
  );
}
