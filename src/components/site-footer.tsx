import Link from "next/link";
import { DISCLAIMER } from "@/lib/domain";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-sunken/60">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr] lg:px-8">
        <div>
          <p className="font-display text-lg font-semibold">SafeBite</p>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">{DISCLAIMER}</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-ink">Learn more</p>
          <ul className="mt-2 space-y-1 text-ink-muted">
            <li><Link className="hover:text-brand-strong" href="/methodology">How scoring works</Link></li>
            <li><Link className="hover:text-brand-strong" href="/demo">Demo guide</Link></li>
            <li><Link className="hover:text-brand-strong" href="/api/health">System status</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
