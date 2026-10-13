import { AlertTriangle, Info } from "lucide-react";
import type { TransparencyResult } from "@/lib/scoring/transparency";
import { DISCLAIMER } from "@/lib/domain";

// Shows evidence confidence and its components. Unresolved official violations are
// rendered in their own block, never folded into the confidence number.
export function ScorePanel({ t }: { t: TransparencyResult }) {
  return (
    <section aria-labelledby="score-heading" className="card p-6 sm:p-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <p className="eyebrow">Evidence confidence</p>
          <h2 id="score-heading" className="mt-2 text-2xl">How much can be verified</h2>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-6xl font-semibold text-ink" aria-label={`${t.score} out of 100`}>{t.score}</span>
            <span className="text-sm text-ink-muted">/ 100</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-brand-strong">{t.label}</p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="presentation">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${t.score}%` }} />
          </div>
          <p className="mt-4 flex gap-2 rounded-2xl bg-sunken p-3 text-xs leading-relaxed text-ink-muted">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {DISCLAIMER}
          </p>
        </div>
        <div>
          <h3 className="text-base font-semibold">How the number is built</h3>
          <ul className="mt-3 space-y-3">
            {t.components.map((c) => (
              <li key={c.key} className="rounded-2xl border border-line p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{c.label}</span>
                  <span className="tabular-nums text-ink-muted">
                    {c.value}/100 × {Math.round(c.weight * 100)}% = <strong className="text-ink">{c.contribution.toFixed(1)}</strong>
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-brand/70" style={{ width: `${c.value}%` }} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{c.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {t.unresolvedOfficial.critical + t.unresolvedOfficial.major > 0 ? (
        <p className="mt-6 flex gap-2 rounded-2xl border border-critical/20 bg-critical-soft p-4 text-sm text-critical">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          This restaurant has unresolved official critical or major findings. They are listed separately below and are not averaged into the confidence number.
        </p>
      ) : null}
    </section>
  );
}
