import type { Metadata } from "next";
import { Download, Database } from "lucide-react";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { buildAnalytics } from "@/lib/data/analytics";
import { loadRestaurantProfiles } from "@/lib/data/repository";
import { isDemoAdminEnabled } from "@/lib/security/guards";
import { BIGQUERY_SCHEMA, type ExportTable } from "@/lib/cloud/export";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  if (!isDemoAdminEnabled()) {
    return <EmptyState title="Analytics is disabled here" body="The operator dashboard needs an authentication layer before it can be exposed. Set SAFEBITE_ENABLE_DEMO_ADMIN only behind that layer." />;
  }
  const asOfMs = Date.now();
  const profiles = await loadRestaurantProfiles(asOfMs);
  const data = await buildAnalytics(profiles, asOfMs);
  const tables = Object.keys(BIGQUERY_SCHEMA) as ExportTable[];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">Business analytics</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Evidence health across the platform</h1>
          <p className="mt-3 text-ink-muted">Every chart is computed from the stored records. Figures describe evidence and records, not restaurant safety.</p>
        </div>
        <p className="text-xs text-ink-muted">Generated {new Date(data.generatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</p>
      </header>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Restaurants", value: data.totals.restaurants },
          { label: "Inspection records", value: data.totals.inspections },
          { label: "Findings", value: data.totals.findings },
          { label: "Documents", value: data.totals.documents },
          { label: "Community reports", value: data.totals.reports },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{kpi.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="complete-heading" className="card p-6">
        <h2 id="complete-heading" className="text-xl">Data completeness</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {data.dataCompleteness.map((row) => (
            <li key={row.key}>
              <div className="flex justify-between text-sm">
                <span>{row.label}</span>
                <span className="font-semibold tabular-nums">{row.percent}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-sunken" role="presentation">
                <div className="h-full rounded-full bg-brand" style={{ width: `${row.percent}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <AnalyticsCharts data={data} />

      <section aria-labelledby="queue-heading" className="card p-6">
        <h2 id="queue-heading" className="text-xl">Reports requiring moderation</h2>
        {data.reportsRequiringModeration.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">The queue is clear.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <tr><th scope="col" className="py-2">Restaurant</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Incident</th></tr>
              </thead>
              <tbody>
                {data.reportsRequiringModeration.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2">{r.restaurant}</td>
                    <td>{r.category.replace(/_/g, " ").toLowerCase()}</td>
                    <td>{r.status.replace("_", " ").toLowerCase()}</td>
                    <td className="tabular-nums">{r.incidentDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="export-heading" className="card p-6">
        <div className="flex items-start gap-3">
          <Database size={20} className="mt-1 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <h2 id="export-heading" className="text-xl">Export-ready data</h2>
            <p className="mt-1 text-sm text-ink-muted">Download the same tables that map to the BigQuery schema. Load them into Looker Studio or any BI tool. Nothing leaves this machine.</p>
          </div>
        </div>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {tables.map((table) => (
            <li key={table} className="flex flex-col gap-2 rounded-2xl border border-line p-4">
              <p className="font-mono text-sm font-semibold">{table}</p>
              <p className="text-xs text-ink-muted">{BIGQUERY_SCHEMA[table].length} columns</p>
              <div className="mt-auto flex gap-2">
                <a className="btn btn-secondary px-3 py-1.5 text-xs" href={`/api/analytics/export?table=${table}&format=csv`}><Download size={13} aria-hidden="true" /> CSV</a>
                <a className="btn btn-secondary px-3 py-1.5 text-xs" href={`/api/analytics/export?table=${table}&format=jsonl`}><Download size={13} aria-hidden="true" /> JSON Lines</a>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
