import Link from "next/link";
import { Notice } from "@/components/ui";

export function AdminPage({ title, subtitle, actions, children, searchParams }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; searchParams?: { ok?: string; error?: string } }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-burgundy">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-grey-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {searchParams?.ok && <Notice kind="success">{searchParams.ok}</Notice>}
      {searchParams?.error && <Notice kind="error">{searchParams.error}</Notice>}
      {children}
    </div>
  );
}

export function Panel({ title, children, actions, className }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-grey-200 bg-white ${className ?? ""}`}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grey-100 px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-grey-200 bg-white p-5 transition hover:border-burgundy/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-burgundy">{value}</p>
      {hint && <p className="mt-1 text-xs text-grey-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Back({ href }: { href: string }) {
  return <input type="hidden" name="back" value={href} />;
}

export function Select({ name, options, defaultValue, label, id }: { name: string; options: (string | [string, string])[]; defaultValue?: string | null; label?: string; id?: string }) {
  const sid = id ?? `s-${name}`;
  return (
    <div>
      {label && <label htmlFor={sid} className="label">{label}</label>}
      <select id={sid} name={name} defaultValue={defaultValue ?? undefined} className="input">
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o.replace(/_/g, " ").toLowerCase()];
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function TextField({ name, label, defaultValue, type = "text", required, placeholder, hint, ...rest }: { name: string; label: string; defaultValue?: string | number | null; type?: string; required?: boolean; placeholder?: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  const id = rest.id ?? `t-${name}`;
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={name} type={type} defaultValue={defaultValue ?? undefined} required={required} placeholder={placeholder} className="input" {...rest} />
      {hint && <p className="mt-1 text-xs text-grey-500">{hint}</p>}
    </div>
  );
}

export function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-burgundy" /> {label}
    </label>
  );
}

export const koboToInput = (k: number | null | undefined) => (k == null ? "" : String(k / 100));

export type SP = Promise<Record<string, string | undefined>>;
