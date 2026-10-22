import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer, Toaster } from "@/components/cart/CartUI";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getCurrentUser } from "@/server/auth/current";
import { listCategories } from "@/server/services/catalogue";
import { getSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, user] = await Promise.all([getSettings(), listCategories(), getCurrentUser()]);
  const cats = categories.map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:font-semibold focus:text-burgundy-800">
        Skip to content
      </a>
      <Header categories={cats} announcement={settings.announcement} userName={user?.name ?? null} logoUrl={settings.logoUrl} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer settings={settings} categories={cats} />
      <CartDrawer />
      <Toaster />
    </CartProvider>
  );
}
