import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/restaurants", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/documents", label: "Documents" },
  { href: "/community", label: "Report a concern" },
  { href: "/analytics", label: "Analytics" },
  { href: "/methodology", label: "Methodology" },
  { href: "/demo", label: "Demo guide" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-full pr-2 font-display text-lg font-semibold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          SafeBite
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand-strong">
              {item.label}
            </Link>
          ))}
        </nav>
        <details className="group relative lg:hidden">
          <summary className="btn btn-secondary cursor-pointer list-none px-4 py-2 text-sm [&::-webkit-details-marker]:hidden">Menu</summary>
          <nav aria-label="Mobile" className="card absolute right-0 mt-2 flex w-64 flex-col gap-1 p-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-brand-soft">
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
