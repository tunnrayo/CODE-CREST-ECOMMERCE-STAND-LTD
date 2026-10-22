import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, CheckCircle2, PackageSearch } from "lucide-react";
import clsx from "clsx";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-grey-500 sm:text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {it.href && i < items.length - 1 ? (
              <Link href={it.href} className="hover:text-burgundy hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "font-medium text-grey-800" : ""}>
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-burgundy-50 via-white to-lime-50">
      <div className="container-x py-8 sm:py-10">
        {children}
        <h1 className="mt-3 text-3xl text-burgundy sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-grey-600">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Pagination({ page, pageCount, makeHref }: { page: number; pageCount: number; makeHref: (p: number) => string }) {
  if (pageCount <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const cls = "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-medium";
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1.5" data-testid="pagination">
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className={clsx(cls, "hover:bg-grey-100")} aria-label="Previous page" rel="prev">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={clsx(cls, "text-grey-300")} aria-hidden><ChevronLeft className="h-4 w-4" /></span>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className={clsx(cls, "text-grey-400")}>…</span>
        ) : (
          <Link key={p} href={makeHref(p)} aria-current={p === page ? "page" : undefined} className={clsx(cls, p === page ? "bg-burgundy text-white" : "hover:bg-grey-100")}>
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={makeHref(page + 1)} className={clsx(cls, "hover:bg-grey-100")} aria-label="Next page" rel="next">
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={clsx(cls, "text-grey-300")} aria-hidden><ChevronRight className="h-4 w-4" /></span>
      )}
    </nav>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-grey-300 bg-grey-50 px-6 py-16 text-center" data-testid="empty-state">
      <PackageSearch className="h-12 w-12 text-burgundy/40" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {message && <p className="mt-1 max-w-md text-sm text-grey-600">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Notice({ kind = "info", title, children, className }: { kind?: "info" | "warning" | "success" | "error"; title?: string; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "border-burgundy/15 bg-burgundy-50 text-burgundy-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-lime-300 bg-lime-50 text-lime-900",
    error: "border-red-200 bg-red-50 text-red-800",
  }[kind];
  const Icon = kind === "success" ? CheckCircle2 : kind === "info" ? Info : AlertTriangle;
  return (
    <div className={clsx("flex gap-3 rounded-2xl border p-4 text-sm", styles, className)} role={kind === "error" ? "alert" : "note"}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    CONFIRMED: "bg-blue-50 text-blue-800",
    PROCESSING: "bg-indigo-50 text-indigo-800",
    SHIPPED: "bg-burgundy-100 text-burgundy-700",
    DELIVERED: "bg-lime-100 text-lime-800",
    CANCELLED: "bg-grey-200 text-grey-700",
    REFUNDED: "bg-grey-200 text-grey-700",
    UNPAID: "bg-grey-100 text-grey-700",
    PAID: "bg-lime-100 text-lime-800",
    FAILED: "bg-red-100 text-red-800",
    SUCCESS: "bg-lime-100 text-lime-800",
    INITIATED: "bg-grey-100 text-grey-700",
    ABANDONED: "bg-grey-100 text-grey-700",
    PUBLISHED: "bg-lime-100 text-lime-800",
    DRAFT: "bg-grey-100 text-grey-700",
    ARCHIVED: "bg-grey-200 text-grey-600",
    SENT: "bg-lime-100 text-lime-800",
    NOT_CONFIGURED: "bg-amber-100 text-amber-800",
    QUEUED: "bg-grey-100 text-grey-700",
  };
  return <span className={clsx("badge", map[status] ?? "bg-grey-100 text-grey-700")}>{status.replace(/_/g, " ").toLowerCase()}</span>;
}
