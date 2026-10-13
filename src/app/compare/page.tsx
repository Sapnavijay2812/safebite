import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { buildComparison, parseCompareSlugs } from "@/lib/compare/compare";
import { toCompareSubject } from "@/lib/compare/subjects";
import { loadRestaurantProfile, loadRestaurantProfiles } from "@/lib/data/repository";
import { EmptyState } from "@/components/empty-state";
import type { SearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Compare restaurants" };
export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const asOfMs = Date.now();
  const all = await loadRestaurantProfiles(asOfMs);
  // Repeated checkbox values (slugs=a&slugs=b) and comma-separated links both work.
  const raw = Array.isArray(sp.slugs) ? sp.slugs.join(",") : sp.slugs;
  const parsed = parseCompareSlugs(raw);

  const header = (
    <header className="max-w-3xl">
      <p className="eyebrow">Compare</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Side-by-side evidence</h1>
      <p className="mt-3 text-ink-muted">Compare two or three restaurants on recorded evidence. The comparison does not rank them or declare one safer.</p>
    </header>
  );

  const picker = (
    <form method="get" action="/compare" className="card grid gap-4 p-6" aria-labelledby="pick-heading">
      <h2 id="pick-heading" className="text-lg">Choose 2 to 3 restaurants</h2>
      <fieldset>
        <legend className="sr-only">Restaurants</legend>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((p) => {
            const checked = parsed.ok && parsed.slugs.includes(p.slug);
            return (
              <li key={p.slug}>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${checked ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong"}`}>
                  <input type="checkbox" name="slugs" value={p.slug} defaultChecked={checked} className="h-4 w-4 accent-[var(--color-brand)]" />
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-auto text-xs text-ink-muted">{p.transparency.score}/100</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <p className="text-xs text-ink-muted">Use the Compare buttons on restaurant cards to build a selection, or tick boxes here and apply.</p>
      <div>
        <button type="submit" className="btn btn-primary">Compare selected</button>
      </div>
    </form>
  );

  if (!parsed.ok) {
    return (
      <div className="space-y-8">
        {header}
        {raw ? <p role="alert" className="rounded-xl bg-critical-soft p-3 text-sm text-critical">{parsed.reason}</p> : null}
        {picker}
        <EmptyState title="Nothing to compare yet" body={parsed.reason} action={{ href: "/restaurants", label: "Explore restaurants" }} />
      </div>
    );
  }

  const profiles = await Promise.all(parsed.slugs.map((s) => loadRestaurantProfile(s, asOfMs)));
  const missing = parsed.slugs.filter((_, i) => profiles[i] === null);
  if (missing.length) {
    return (
      <div className="space-y-8">
        {header}
        {picker}
        <p role="alert" className="rounded-xl bg-critical-soft p-3 text-sm text-critical">Restaurant not found: {missing.join(", ")}.</p>
      </div>
    );
  }

  const comparison = buildComparison(profiles.map((p) => toCompareSubject(p!, asOfMs)));
  const subjects = profiles.map((p) => p!);

  return (
    <div className="space-y-8">
      {header}
      {picker}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">Side-by-side comparison of recorded evidence</caption>
          <thead>
            <tr className="border-b border-line bg-sunken/60">
              <th scope="col" className="w-56 p-4 font-semibold text-ink-muted">Measure</th>
              {subjects.map((s) => (
                <th key={s.slug} scope="col" className="p-4 font-display text-lg">
                  <Link href={`/restaurants/${s.slug}`} className="hover:text-brand-strong">{s.name}</Link>
                  <span className="mt-1 block text-xs font-sans font-normal text-ink-muted">{s.cuisine}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.key} className="border-b border-line last:border-0">
                <th scope="row" className="p-4 align-top text-xs font-semibold uppercase tracking-wide text-ink-muted">{row.label}</th>
                {subjects.map((s) => (
                  <td key={s.slug} className="p-4 align-top">{row.values[s.slug]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="obs-heading" className="card p-6">
        <h2 id="obs-heading" className="text-xl">What the records show</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {comparison.observations.map((o) => <li key={o}>{o}</li>)}
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-sunken p-3 text-xs text-ink-muted">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {comparison.disclaimer}
        </p>
      </section>

      <section aria-labelledby="ai-compare" className="card p-6">
        <h2 id="ai-compare" className="text-xl">Ask the explainer about this pair</h2>
        <p className="mt-1 text-sm text-ink-muted">Open a profile and choose a comparison in the AI explainer for a cited, side-by-side answer.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <li key={s.slug}><Link href={`/restaurants/${s.slug}?q=${encodeURIComponent("How does this restaurant compare with another?")}#ai`} className="btn btn-secondary px-3 py-1.5 text-sm">Open {s.name}</Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
