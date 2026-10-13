import type { Metadata } from "next";
import { COMPONENT_WEIGHTS, COVERAGE_WINDOW_DAYS, CONTRADICTION_PENALTY, FRESHNESS_BANDS, TIER_WEIGHTS } from "@/lib/scoring/transparency";
import { HYGIENE_CATEGORIES, TIER_LABELS, EVIDENCE_TIERS, DISCLAIMER } from "@/lib/domain";
import { EvidenceTierBadge } from "@/components/evidence-tier-badge";

export const metadata: Metadata = { title: "Methodology" };

const WEIGHT_LABELS: Record<keyof typeof COMPONENT_WEIGHTS, string> = {
  coverage: "Hygiene category coverage",
  freshness: "Evidence freshness",
  sourceQuality: "Source quality",
  consistency: "Consistency across sources",
};

export default function MethodologyPage() {
  return (
    <div className="space-y-12 max-w-4xl">
      <header>
        <p className="eyebrow">Methodology</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">How SafeBite measures evidence</h1>
        <p className="mt-4 text-ink-muted">
          SafeBite shows how much verifiable food safety evidence exists for a restaurant. It does not claim to know how safe a kitchen is, and it does not issue certifications. The rules below are deterministic: the same records always produce the same numbers.
        </p>
        <p className="mt-4 rounded-2xl bg-sunken p-4 text-sm text-ink-muted">{DISCLAIMER}</p>
      </header>

      <section aria-labelledby="tiers" className="space-y-4">
        <h2 id="tiers" className="text-2xl">1. Evidence tiers</h2>
        <p className="text-sm text-ink-muted">Every record is tagged with where it came from. Tier decides how much it can contribute to the source-quality score.</p>
        <table className="card w-full overflow-hidden text-left text-sm">
          <thead className="border-b border-line bg-sunken/60 text-xs uppercase tracking-wide text-ink-muted">
            <tr><th scope="col" className="p-3">Tier</th><th scope="col" className="p-3">Meaning</th><th scope="col" className="p-3">Weight</th></tr>
          </thead>
          <tbody>
            {EVIDENCE_TIERS.map((tier) => (
              <tr key={tier} className="border-b border-line last:border-0 align-top">
                <td className="p-3"><EvidenceTierBadge tier={tier} /></td>
                <td className="p-3 text-ink-muted">{TIER_LABELS[tier].description}</td>
                <td className="p-3 tabular-nums font-semibold">{TIER_WEIGHTS[tier].toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-ink-muted">AI-inferred signals and unverified allegations never contribute to any score. AI-generated text can never set a rating on its own.</p>
      </section>

      <section aria-labelledby="formula" className="space-y-4">
        <h2 id="formula" className="text-2xl">2. Evidence confidence (0–100)</h2>
        <p className="text-sm text-ink-muted">
          Evidence confidence = round( {Object.entries(COMPONENT_WEIGHTS).map(([k, w]) => `${Math.round(w * 100)}% × ${WEIGHT_LABELS[k as keyof typeof WEIGHT_LABELS].toLowerCase()}`).join(" + ")} ).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="card p-5">
            <h3 className="text-lg">Coverage</h3>
            <p className="mt-2 text-sm text-ink-muted">Share of the six hygiene categories with at least one usable item (official, independently checked or self-reported) dated within the last {COVERAGE_WINDOW_DAYS} days. Each covered category is worth the same.</p>
          </article>
          <article className="card p-5">
            <h3 className="text-lg">Freshness</h3>
            <p className="mt-2 text-sm text-ink-muted">Age of the latest official inspection:</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink-muted">
              {FRESHNESS_BANDS.map((b) => <li key={b.maxDays}>up to {b.maxDays} days ({b.label}): {b.score}</li>)}
              <li>older, or no official inspection: 0 (unknown, not unsafe)</li>
            </ul>
          </article>
          <article className="card p-5">
            <h3 className="text-lg">Source quality</h3>
            <p className="mt-2 text-sm text-ink-muted">Average tier weight across all usable items, scaled to 100. A record from an official source counts fully; a self-reported one counts at 40%.</p>
          </article>
          <article className="card p-5">
            <h3 className="text-lg">Consistency</h3>
            <p className="mt-2 text-sm text-ink-muted">Starts at 100. Each category where a self-reported compliance claim conflicts with an unresolved official finding removes {CONTRADICTION_PENALTY} points. With no usable evidence, consistency is 0.</p>
          </article>
        </div>
        <p className="text-sm text-ink-muted">Labels: 80+ strong, 60–79 good, 40–59 partial, under 40 limited. These describe evidence coverage only.</p>
      </section>

      <section aria-labelledby="separate" className="space-y-3">
        <h2 id="separate" className="text-2xl">3. What is kept separate</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-muted">
          <li><strong className="text-ink">Unresolved official violations</strong> are listed on their own, with severity and category. They are never averaged into evidence confidence, and a critical one is never hidden by good coverage.</li>
          <li><strong className="text-ink">Missing evidence</strong> is shown as unknown. It lowers evidence confidence only because it is absent from the record, not because it proves a problem.</li>
          <li><strong className="text-ink">Community reports</strong> are unverified. They are never scored, and only corroborated ones are shown, labelled as allegations.</li>
          <li><strong className="text-ink">AI output</strong> is explanatory. Every restaurant-specific sentence must cite a record, and the score is never produced or changed by a model.</li>
        </ul>
      </section>

      <section aria-labelledby="weights" className="space-y-3">
        <h2 id="weights" className="text-2xl">4. Component weights</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(COMPONENT_WEIGHTS) as Array<keyof typeof COMPONENT_WEIGHTS>).map((k) => (
            <li key={k} className="card flex items-center justify-between p-4 text-sm">
              <span>{WEIGHT_LABELS[k]}</span>
              <span className="font-semibold tabular-nums">{Math.round(COMPONENT_WEIGHTS[k] * 100)}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="categories" className="space-y-3">
        <h2 id="categories" className="text-2xl">5. Hygiene categories</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {HYGIENE_CATEGORIES.map((c) => (
            <li key={c.key} className="card p-4 text-sm"><strong>{c.label}</strong><p className="mt-1 text-ink-muted">{c.description}</p></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="limits" className="space-y-3">
        <h2 id="limits" className="text-2xl">6. Limitations</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-muted">
          <li>The demo uses fictional restaurants and simulated records. Simulated authority records are not genuine.</li>
          <li>SafeBite does not verify whether a document is authentic. Uploads are labelled by who produced them, not by authenticity.</li>
          <li>An inspection is a snapshot. A restaurant can change between visits, and an old record can be misleading.</li>
          <li>Evidence confidence can be high for a restaurant with real problems, if those problems are well documented. Read the findings, not just the number.</li>
          <li>The scoring model is a documented, auditable heuristic. It has not been validated against health outcomes.</li>
        </ul>
      </section>

      <section aria-labelledby="verify" className="space-y-3">
        <h2 id="verify" className="text-2xl">7. How to check the model</h2>
        <p className="text-sm text-ink-muted">The calculation is implemented in <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">src/lib/scoring/transparency.ts</code> with unit tests in <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">transparency.test.ts</code>. Full details are in <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">docs/METHODOLOGY.md</code>.</p>
      </section>
    </div>
  );
}
