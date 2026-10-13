"use client";

import Link from "next/link";
import { GitCompareArrows, X } from "lucide-react";
import { useCompareSelection, MAX_SELECTION } from "./use-compare-selection";

// Fixed bar that appears once at least one restaurant is picked. It links to /compare.
export function CompareTray() {
  const { selected, toggle, clear, ready } = useCompareSelection();
  if (!ready || selected.length === 0) return null;
  const canCompare = selected.length >= 2;
  return (
    <div role="region" aria-label="Comparison selection" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-3xl border border-line bg-ink px-4 py-3 text-white shadow-[0_20px_50px_-20px_rgb(0_0_0/0.5)]">
        <GitCompareArrows size={18} aria-hidden="true" className="text-accent" />
        <p className="text-sm">
          <span className="font-semibold">{selected.length}</span> of {MAX_SELECTION} selected
          <span className="sr-only">. Choose at least two to compare.</span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {selected.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => toggle(slug)}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
                aria-label={`Remove ${slug} from comparison`}
              >
                {slug.replace(/-/g, " ")} <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={clear} className="rounded-full px-3 py-2 text-xs font-medium text-white/80 hover:text-white">Clear</button>
          {canCompare ? (
            <Link href={`/compare?slugs=${selected.join(",")}`} className="btn bg-accent px-4 py-2 text-sm text-ink hover:bg-accent-soft">
              Compare now
            </Link>
          ) : (
            <span className="px-3 py-2 text-xs text-white/70">Pick one more to compare</span>
          )}
        </div>
      </div>
    </div>
  );
}
