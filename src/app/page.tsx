import Link from "next/link";
import { ArrowRight, Database, FileSearch, GitCompareArrows, ScanEye, ShieldCheck } from "lucide-react";
import { RestaurantCard } from "@/components/restaurant-card";
import { ScorePanel } from "@/components/score-panel";
import { loadRestaurantProfiles } from "@/lib/data/repository";
import { DEMO_DATA_LABEL } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const profiles = await loadRestaurantProfiles();
  const featured = [...profiles].sort((a, b) => b.transparency.score - a.transparency.score).slice(0, 3);
  const preview = profiles.find((p) => p.slug === "copperleaf-kitchen") ?? profiles[0];

  return (
    <div className="space-y-24">
      <section className="grid items-center gap-12 pt-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" aria-labelledby="hero">
        <div>
          <p className="eyebrow">Food safety transparency</p>
          <h1 id="hero" className="mt-4 text-5xl leading-[1.05] sm:text-6xl">Know your kitchen before your next bite.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            SafeBite shows what verifiable food safety evidence exists for a restaurant: inspection records, documents, independent checks and open violations, each labelled by where it came from.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/restaurants" className="btn btn-primary px-6 py-3">Explore restaurants <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/demo" className="btn btn-secondary px-6 py-3">Take the guided demo</Link>
          </div>
          <p className="mt-6 text-xs font-medium text-ink-muted">{DEMO_DATA_LABEL}.</p>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-brand-soft/70" aria-hidden="true" />
          <div className="card space-y-4 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{preview.name}</p>
              <span className="pill bg-accent-soft text-accent-text">Preview</span>
            </div>
            <p className="font-display text-5xl font-semibold">{preview.transparency.score}<span className="text-lg font-sans text-ink-muted"> / 100</span></p>
            <p className="text-sm font-medium text-brand-strong">{preview.transparency.label}</p>
            <ul className="space-y-2 text-sm">
              {preview.transparency.components.map((c) => (
                <li key={c.key} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-ink-muted">{c.label}</span>
                  <span className="h-2 flex-1 rounded-full bg-sunken"><span className="block h-full rounded-full bg-brand" style={{ width: `${c.value}%` }} /></span>
                  <span className="w-10 text-right tabular-nums">{c.value}</span>
                </li>
              ))}
            </ul>
            <p className="rounded-xl bg-critical-soft p-3 text-xs text-critical">
              {preview.openOfficialFindings.length} unresolved official finding(s) are shown separately, never averaged in.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="value" className="grid gap-6 md:grid-cols-3">
        <h2 id="value" className="sr-only">Why SafeBite</h2>
        {[
          { icon: ShieldCheck, title: "Evidence, not reassurance", body: "A confidence score shows how much can be verified. It is not a safety rating, and missing evidence is shown as unknown, not unsafe." },
          { icon: ScanEye, title: "Provenance on every record", body: "Official, independently checked, self-reported, unverified and AI-inferred information are kept apart and labelled on every page." },
          { icon: FileSearch, title: "Documents read, people decide", body: "Uploaded reports are extracted for review. Nothing is published until a reviewer confirms each field against the original." },
        ].map((item) => (
          <article key={item.title} className="card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong" aria-hidden="true"><item.icon size={20} /></span>
            <h3 className="mt-4 text-xl">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="featured" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 id="featured" className="mt-2 text-3xl">Highest evidence coverage in the demo</h2>
          </div>
          <Link href="/restaurants?sort=EVIDENCE" className="btn btn-ghost">See all restaurants <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <ul className="grid gap-6 md:grid-cols-3">
          {featured.map((p) => (
            <li key={p.slug}><RestaurantCard profile={p} /></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p className="eyebrow">How it works</p>
          <h2 id="how" className="mt-2 text-3xl">From records to a clear picture</h2>
          <ol className="mt-6 space-y-5">
            {[
              { icon: Database, title: "Records are collected", body: "Inspection records, restaurant-submitted documents and independent checks are stored with their source and date." },
              { icon: ScanEye, title: "Evidence is scored openly", body: "Coverage, freshness, source quality and consistency are combined with published weights. Every component is explained." },
              { icon: GitCompareArrows, title: "You compare and ask", body: "Compare restaurants side by side, or ask the explainer. Its answers cite the records they come from." },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden="true">{i + 1}</span>
                <div>
                  <h3 className="text-lg">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <ScorePanel t={preview.transparency} />
      </section>

      <section aria-labelledby="cta" className="card flex flex-col items-start gap-6 bg-ink p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div>
          <h2 id="cta" className="text-3xl text-white">Start with a restaurant you know.</h2>
          <p className="mt-2 max-w-xl text-white/75">Open a profile, read the evidence, then ask the explainer what is missing. Or see how a report moves through moderation.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/restaurants" className="btn bg-accent px-6 py-3 text-ink hover:bg-accent-soft">Explore restaurants</Link>
          <Link href="/community" className="btn border-white/30 bg-transparent px-6 py-3 text-white hover:bg-white/10">Report a concern</Link>
        </div>
      </section>
    </div>
  );
}
