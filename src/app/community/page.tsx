import type { Metadata } from "next";
import { ShieldQuestion } from "lucide-react";
import { ReportForm } from "@/components/report-form";
import { db } from "@/lib/data/db";
import { CATEGORY_LABELS, REPORT_STATUSES } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { first, type SearchParams } from "@/lib/page-params";

export const metadata: Metadata = { title: "Report a concern" };
export const dynamic = "force-dynamic";

export default async function CommunityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [restaurants, counts, corroborated] = await Promise.all([
    db.restaurant.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.communityReport.groupBy({ by: ["status"], _count: { _all: true } }),
    db.communityReport.findMany({
      where: { status: "CORROBORATED" },
      orderBy: { incidentDate: "desc" },
      take: 20,
      include: { restaurant: { select: { name: true } } },
    }),
  ]);
  const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const preselect = first(sp.restaurant);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="eyebrow">Community reports</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Tell us what you saw</h1>
        <p className="mt-3 text-ink-muted">
          Reports are saved as unverified and go through moderation. A report appears publicly only after a moderator has corroborated it, and even then it is labelled as an unverified allegation, not an official finding.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ReportForm restaurants={restaurants} defaultSlug={preselect} today={today} />

        <aside className="space-y-6" aria-label="How moderation works">
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-lg"><ShieldQuestion size={18} aria-hidden="true" /> How reports are handled</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {REPORT_STATUSES.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold">{i + 1}</span>
                  <span>
                    <strong className="block">{s.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</strong>
                    <span className="text-ink-muted">{STATUS_TEXT[s]}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-ink-muted">Current queue: {countFor("PENDING")} pending · {countFor("UNDER_REVIEW")} under review · {countFor("CORROBORATED")} corroborated · {countFor("REJECTED")} rejected</p>
          </section>
        </aside>
      </div>

      <section aria-labelledby="corro-heading" className="space-y-4">
        <div>
          <h2 id="corro-heading" className="text-2xl">Corroborated community reports</h2>
          <p className="mt-1 text-sm text-ink-muted">Moderator-reviewed allegations. They are not verified facts and are not official findings.</p>
        </div>
        {corroborated.length === 0 ? (
          <p className="card p-5 text-sm text-ink-muted">No reports have been corroborated yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {corroborated.map((r) => (
              <li key={r.id} className="card p-5">
                <p className="text-sm font-semibold">{r.restaurant.name} · {CATEGORY_LABELS[r.category] ?? "Other"}</p>
                <p className="text-xs text-ink-muted">Incident {formatDate(r.incidentDate.toISOString().slice(0, 10))}</p>
                <p className="mt-2 text-sm">{r.description}</p>
                <p className="mt-3"><span className="pill bg-warn-soft text-warn">Unverified allegation · corroborated</span></p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Received and waiting for a moderator. Not shown publicly.",
  UNDER_REVIEW: "A moderator is checking the report against other records. Not shown publicly.",
  CORROBORATED: "Supported by moderator checks and shown as an unverified allegation.",
  REJECTED: "Spam, off-topic, or not a food safety concern. Kept for audit, not shown.",
};
