import type { Metadata, Viewport } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s | ${BRAND.name}` },
  description: "Code Crest is a Nigerian e-commerce store for everyday electronics, home & kitchen, fashion, beauty, office, kids and outdoor essentials. Smart Shopping. Seamless Living.",
  applicationName: BRAND.name,
  openGraph: { type: "website", siteName: BRAND.name, locale: "en_NG" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: BRAND.colors.burgundy, width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
