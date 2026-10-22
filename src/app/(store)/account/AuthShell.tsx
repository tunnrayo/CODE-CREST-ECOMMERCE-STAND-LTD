import { LogoMark } from "@/components/brand/Logo";

export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="container-x grid max-w-5xl gap-8 py-12 md:grid-cols-2 md:items-center">
      <div className="hidden rounded-3xl bg-burgundy p-10 text-white md:block">
        <LogoMark className="h-16 w-auto" onDark />
        <h2 className="mt-6 text-3xl font-bold text-white">Smart Shopping.<br /><span className="text-lime">Seamless Living.</span></h2>
        <p className="mt-4 text-white/80">Save addresses, track orders and keep a wishlist of the products you love.</p>
      </div>
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl text-burgundy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-grey-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {aside && <div className="mt-6 border-t border-grey-200 pt-5 text-sm text-grey-600">{aside}</div>}
      </div>
    </div>
  );
}
