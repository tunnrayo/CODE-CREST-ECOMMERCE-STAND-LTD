import clsx from "clsx";

const CART =
  "M104,216a16,16,0,1,1-16-16A16,16,0,0,1,104,216Zm88-16a16,16,0,1,0,16,16A16,16,0,0,0,192,200ZM239.71,74.14l-25.64,92.28A24.06,24.06,0,0,1,191,184H92.16A24.06,24.06,0,0,1,69,166.42L33.92,40H16a8,8,0,0,1,0-16H40a8,8,0,0,1,7.71,5.86L57.19,64H232a8,8,0,0,1,7.71,10.14ZM221.47,80H61.64l22.81,82.14A8,8,0,0,0,92.16,168H191a8,8,0,0,0,7.71-5.86Z";

/** Code Crest symbol: speed lines + crest "C" + cart. */
export function LogoMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true" focusable="false">
      <g fill="#A8E620">
        <rect x="4" y="34" width="22" height="7" rx="3.5" />
        <rect x="0" y="46" width="26" height="7" rx="3.5" />
        <rect x="9" y="58" width="17" height="7" rx="3.5" />
      </g>
      <path d="M96.3 21.7 A40 40 0 1 0 96.3 78.3" fill="none" stroke="#A8E620" strokeWidth="14" strokeLinecap="round" />
      <path transform="translate(52 30) scale(0.165)" fill={onDark ? "#FFFFFF" : "#680F24"} d={CART} />
    </svg>
  );
}

/**
 * Full logo lock-up. If a custom logo URL is configured in Store Settings it
 * replaces the built-in mark, so the logo can change without a redesign.
 */
export function Logo({ onDark = false, logoUrl, compact = false, className }: { onDark?: boolean; logoUrl?: string | null; compact?: boolean; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="Code Crest" className={clsx("h-10 w-auto", className)} />;
  }
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-9 w-auto sm:h-10" onDark={onDark} />
      <span className="flex flex-col leading-none">
        <span className={clsx("text-xl font-bold tracking-tight sm:text-[22px]", onDark ? "text-white" : "text-burgundy")}>
          Code <span className={onDark ? "text-lime" : "text-lime-600"}>Crest</span>
        </span>
        {!compact && <span className={clsx("mt-1 text-[8.5px] font-semibold tracking-[0.22em]", onDark ? "text-white/80" : "text-burgundy/80")}>ECOMMERCE STAND LTD</span>}
      </span>
    </span>
  );
}
