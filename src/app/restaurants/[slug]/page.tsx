import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDashed, FileText, MapPin, MessageSquareWarning } from "lucide-react";
import { loadRestaurantProfile, loadRestaurantProfiles } from "@/lib/data/repository";
import { CATEGORY_LABELS, HYGIENE_CATEGORIES, TIER_LABELS, type EvidenceTier } from "@/lib/domain";
import { ScorePanel } from "@/components/score-panel";
import { EvidenceTierBadge } from "@/components/evidence-tier-badge";
import { RestaurantImage } from "@/components/restaurant-image";
import { AiExplainer } from "@/components/ai-explainer";
import { CompareToggle } from "@/components/compare-toggle";
import { formatDate } from "@/lib/format";
import { first, type SearchParams } from "@/lib/page-params";
import { isPubliclyListable } from "@/lib/moderation/moderation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadRestaurantProfile(slug);
  return { title: profile ? `${profile.name} — safety evidence profile` : "Restaurant not found" };
}

export default async function RestaurantProfilePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await loadRestaurantProfile(slug);
  if (!profile) notFound();
  const others = (await loadRestaurantProfiles()).filter((p) => p.slug !== profile.slug);
  const t = profile.transparency;
  const coverageByKey = new Map(t.categories.map((c) => [c.key, c]));
  const corroborated = profile.communityReports.filter((r) => isPubliclyListable(r.status));
  const initialQuestion = first(sp.q) ?? "";

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/restaurants" className="hover:text-brand-strong">Explore</Link> <span aria-hidden="true">/</span> <span className="text-ink">{profile.name}</span>
      </nav>

      <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
        <div>
          <p className="eyebrow">{profile.cuisine} · {"$".repeat(profile.priceTier)} · Fictional demo restaurant</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{profile.name}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted"><MapPin size={15} aria-hidden="true" /> {profile.location.addressLine}, {profile.location.neighborhood}, {profile.location.city}</p>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-muted">{profile.description}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="#ai" className="btn btn-primary">Ask the AI explainer</a>
            <Link href="#inspections" className="btn btn-secondary">Inspection history</Link>
            <CompareToggle slug={profile.slug} name={profile.name} />
          </div>
        </div>
        <RestaurantImage name={profile.name} accent={profile.accentColor} cuisine={profile.cuisine} className="hidden h-52 w-full rounded-[1.5rem] md:block" />
      </header>

      {t.unresolvedOfficial.critical + t.unresolvedOfficial.major > 0 || profile.openOfficialFindings.some((f) => f.severity === "CRITICAL") ? (
        <section aria-labelledby="alert-heading" className="rounded-3xl border border-critical/30 bg-critical-soft p-5 sm:p-6">
          <h2 id="alert-heading" className="flex items-center gap-2 text-xl text-critical"><AlertTriangle size={20} aria-hidden="true" /> Unresolved official violations</h2>
          <p className="mt-1 text-sm text-critical/90">Shown separately from the evidence confidence. A critical or major finding is never averaged away.</p>
          <ul className="mt-4 grid gap-3">
            {profile.openOfficialFindings.map((f) => (
              <li key={f.id} className="rounded-2xl bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className={`pill ${f.severity === "CRITICAL" ? "bg-critical text-white" : "bg-accent-soft text-accent-text"}`}>{f.severity.toLowerCase()}</span>
                  <span className="text-ink-muted">{f.categoryLabel} · recorded {formatDate(f.inspectedAt)}</span>
                </div>
                <p className="mt-2 text-sm">{f.description}</p>
                <p className="mt-1 text-xs text-ink-muted">{f.remediation ? `Remediation recorded: ${f.remediation}` : "No remediation recorded yet."}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-muted">
          <CheckCircle2 size={16} className="text-brand" aria-hidden="true" />
          No unresolved official critical or major findings are on record. This does not mean the restaurant has been certified.
        </p>
      )}

      <ScorePanel t={t} />

      <section id="coverage" aria-labelledby="coverage-heading" className="space-y-4 scroll-mt-24">
        <div>
          <p className="eyebrow">Hygiene categories</p>
          <h2 id="coverage-heading" className="mt-1 text-2xl">What evidence exists for each area</h2>
          <p className="mt-1 text-sm text-ink-muted">Unknown is not the same as unsafe. A category with no evidence is listed as unknown.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HYGIENE_CATEGORIES.map((c) => {
            const cov = coverageByKey.get(c.key);
            const covered = cov?.covered ?? false;
            return (
              <li key={c.key} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base">{c.label}</h3>
                  {covered ? <CheckCircle2 size={18} className="shrink-0 text-brand" aria-label="Evidence on record" /> : <CircleDashed size={18} className="shrink-0 text-ink-muted" aria-label="Unknown: no evidence on record" />}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{c.description}</p>
                <p className="mt-3 text-xs font-semibold">
                  {covered
                    ? <span className="text-brand-strong">{cov!.sourceCount} evidence item{cov!.sourceCount === 1 ? "" : "s"} · latest {formatDate(cov!.latestDateMs ? new Date(cov!.latestDateMs).toISOString().slice(0, 10) : null)}</span>
                    : <span className="text-ink-muted">Unknown — no evidence in the last 18 months</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="inspections" aria-labelledby="inspections-heading" className="scroll-mt-24">
        <p className="eyebrow">Inspection timeline</p>
        <h2 id="inspections-heading" className="mt-1 text-2xl">Inspection history</h2>
        {profile.inspections.length === 0 ? (
          <div className="card mt-4 p-6 text-sm text-ink-muted">No official inspection is on record for this restaurant. Any documents are listed below as self-reported or independently checked, not as official findings.</div>
        ) : (
          <ol className="mt-5 space-y-4 border-l-2 border-line pl-6">
            {profile.inspections.map((insp) => (
              <li key={insp.id} className="relative">
                <span className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-2 border-canvas bg-brand" aria-hidden="true" />
                <article className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={15} aria-hidden="true" /> {formatDate(insp.inspectedAt)}</p>
                    <EvidenceTierBadge tier={insp.tier} />
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">{insp.authorityName} · outcome <strong className="text-ink">{insp.outcome.replace(/_/g, " ").toLowerCase()}</strong></p>
                  <p className="mt-2 text-sm">{insp.summary}</p>
                  {insp.isSimulated ? <p className="mt-2 text-xs font-semibold text-accent-text">Simulated demo record. Not a genuine authority record.</p> : null}
                  {insp.findings.length > 0 ? (
                    <ul id={insp.id === profile.inspections[0]?.id ? "findings" : undefined} className="mt-4 grid gap-2 scroll-mt-24">
                      {insp.findings.map((f) => (
                        <li key={f.id} className="rounded-xl border border-line p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="pill bg-sunken text-ink">{f.severity.toLowerCase()}</span>
                            <span className="text-ink-muted">{f.categoryLabel}</span>
                            <span className={`pill ${f.status === "UNRESOLVED" ? "bg-critical-soft text-critical" : "bg-brand-soft text-brand-strong"}`}>{f.status === "UNRESOLVED" ? "unresolved" : "resolved"}</span>
                          </div>
                          <p className="mt-2">{f.description}</p>
                          <p className="mt-1 text-xs text-ink-muted">{f.remediation ?? "No remediation recorded."}{f.resolvedAt ? ` · resolved ${formatDate(f.resolvedAt)}` : ""}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-ink-muted">No findings recorded in this inspection.</p>
                  )}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section id="documents" aria-labelledby="docs-heading" className="space-y-4 scroll-mt-24">
        <div>
          <p className="eyebrow">Supporting documents</p>
          <h2 id="docs-heading" className="mt-1 text-2xl">Source provenance</h2>
          <p className="mt-1 text-sm text-ink-muted">Each document shows who produced it. Self-reported documents are not independently verified.</p>
        </div>
        {profile.documents.length === 0 ? (
          <p className="card p-5 text-sm text-ink-muted">No supporting documents are on file for this restaurant.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {profile.documents.map((d) => (
              <li key={d.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink-muted" aria-hidden="true"><FileText size={18} /></span>
                  <div className="min-w-0">
                    <h3 className="text-base">{d.title}</h3>
                    <p className="text-xs text-ink-muted">{d.kind.replace(/_/g, " ").toLowerCase()} · issued {formatDate(d.issuedAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <EvidenceTierBadge tier={d.tier} />
                  {d.isSample ? <span className="pill bg-neutral-soft text-ink">Simulated sample</span> : null}
                </div>
                {d.claims.length > 0 ? (
                  <p className="text-xs text-ink-muted">Claims: {d.claims.map((c) => `${CATEGORY_LABELS[c.categoryKey] ?? c.categoryKey} ${c.claimsCompliant ? "compliant" : "not compliant"}`).join("; ")}</p>
                ) : null}
                <a href={d.href} className="btn btn-secondary mt-auto self-start px-3 py-1.5 text-sm" target="_blank" rel="noopener noreferrer">Open document</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="community" aria-labelledby="community-heading" className="space-y-4 scroll-mt-24">
        <div>
          <p className="eyebrow">Community reports</p>
          <h2 id="community-heading" className="mt-1 flex items-center gap-2 text-2xl"><MessageSquareWarning size={22} aria-hidden="true" /> Unverified customer reports</h2>
          <p className="mt-1 text-sm text-ink-muted">Reports are unverified. Only corroborated reports are listed, and those are moderator-reviewed allegations, not official findings.</p>
        </div>
        <p className="text-sm text-ink-muted">
          Pending {profile.communityCounts.PENDING} · under review {profile.communityCounts.UNDER_REVIEW} · corroborated {profile.communityCounts.CORROBORATED} · rejected {profile.communityCounts.REJECTED}
        </p>
        {corroborated.length === 0 ? (
          <p className="card p-5 text-sm text-ink-muted">No corroborated community reports are published for this restaurant.</p>
        ) : (
          <ul className="grid gap-4">
            {corroborated.map((r) => (
              <li key={r.id} className="card p-5">
                <p className="text-xs font-semibold text-ink-muted">{CATEGORY_LABELS[r.category] ?? "Other"} · incident {formatDate(r.incidentDate)}</p>
                <p className="mt-2 text-sm">{r.description}</p>
                <p className="mt-2"><span className="pill bg-warn-soft text-warn">{TIER_LABELS.UNVERIFIED_ALLEGATION.label} · corroborated</span></p>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/community?restaurant=${profile.slug}`} className="btn btn-ghost px-0">Report a concern about {profile.name} →</Link>
      </section>

      <section aria-labelledby="missing-heading" className="card p-6 scroll-mt-24" id="missing">
        <h2 id="missing-heading" className="text-xl">Missing or unknown information</h2>
        {profile.missingInformation.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing is flagged as missing for this profile.</p>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {profile.missingInformation.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
      </section>

      <section id="methodology" className="scroll-mt-24">
        <div className="card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl">How these numbers are derived</h2>
            <p className="mt-1 text-sm text-ink-muted">Evidence tiers, weights and the calculation are published openly, along with the limits of the method.</p>
          </div>
          <Link href="/methodology" className="btn btn-secondary shrink-0">Read the methodology</Link>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(TIER_LABELS) as EvidenceTier[]).map((tier) => (
            <li key={tier}><EvidenceTierBadge tier={tier} /></li>
          ))}
        </ul>
      </section>

      <AiExplainer
        slug={profile.slug}
        initialQuestion={initialQuestion}
        compareOptions={others.map((o) => ({ slug: o.slug, name: o.name }))}
      />

      <section aria-labelledby="compare-heading" className="card p-6">
        <h2 id="compare-heading" className="text-xl">Compare with other demo restaurants</h2>
        <p className="mt-1 text-sm text-ink-muted">Pick up to three restaurants for a side-by-side view of recorded evidence.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.slice(0, 6).map((o) => (
            <li key={o.slug}>
              <Link href={`/compare?slugs=${profile.slug},${o.slug}`} className="btn btn-secondary px-3 py-1.5 text-sm">{profile.name} vs {o.name}</Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-sunken p-4 text-xs text-ink-muted">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Demo data — fictional restaurant and simulated inspection records. SafeBite is informational and is not a government certification authority.
      </p>
    </div>
  );
}
