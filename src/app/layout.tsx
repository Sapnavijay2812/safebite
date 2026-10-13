import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DemoBanner } from "@/components/demo-banner";
import { CompareTray } from "@/components/compare-tray";

export const metadata: Metadata = {
  title: {
    default: "SafeBite — Know your kitchen before your next bite",
    template: "%s · SafeBite",
  },
  description:
    "Evidence-based food safety transparency for smarter food choices. SafeBite is informational and is not a government certification authority.",
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <DemoBanner />
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-32 pt-8 sm:px-6 lg:px-8">
          {children}
        </main>
        <SiteFooter />
        <CompareTray />
      </body>
    </html>
  );
}
