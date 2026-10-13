"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsSnapshot } from "@/lib/data/analytics";

const COLORS = { brand: "#2F6B4F", accent: "#D9733A", critical: "#9B2C2C", muted: "#B9B2A4", ink: "#1F2421", sun: "#E9DDBF" };

const tooltipStyle = { borderRadius: 12, border: "1px solid #E6DFD3", fontSize: 12 };

export function AnalyticsCharts({ data }: { data: AnalyticsSnapshot }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Evidence confidence by restaurant" description="Scored from stored records. Not a safety ranking.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.evidenceCoverage} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.sun} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/100`, "Evidence confidence"]} />
            <Bar dataKey="score" radius={[0, 6, 6, 0]}>
              {data.evidenceCoverage.map((row) => (
                <Cell key={row.slug} fill={row.score >= 60 ? COLORS.brand : row.score >= 40 ? COLORS.accent : COLORS.muted} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Inspection freshness" description="Age of the latest official inspection per restaurant.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.freshnessDistribution} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.sun} vertical={false} />
            <XAxis dataKey="band" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" name="Restaurants" fill={COLORS.brand} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Violation categories" description="Findings by category and severity, from official and independent records.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.violationFrequency} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.sun} vertical={false} />
            <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="critical" stackId="s" fill={COLORS.critical} name="Critical" />
            <Bar dataKey="major" stackId="s" fill={COLORS.accent} name="Major" />
            <Bar dataKey="minor" stackId="s" fill={COLORS.sun} name="Minor" />
            <Bar dataKey="observation" stackId="s" fill={COLORS.muted} name="Observation" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Inspections and findings over 12 months" description="Monthly counts from the inspection records.">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.inspectionTrend} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.sun} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="inspections" stroke={COLORS.brand} strokeWidth={2.5} dot={false} name="Inspections" />
            <Line type="monotone" dataKey="findings" stroke={COLORS.accent} strokeWidth={2.5} dot={false} name="Findings" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Document processing" description="Upload, extraction and publication status.">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={[...data.documentStatus, ...data.extractionStatus.map((e) => ({ status: `extraction: ${e.status}`, count: e.count }))]} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.sun} vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={COLORS.ink} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Moderation queue" description="Community reports by status. Only corroborated reports are ever shown publicly.">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.moderationQueue} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.sun} vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={COLORS.accent} radius={[6, 6, 0, 0]} name="Reports" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-ink-muted">{description}</p>
      <div role="img" aria-label={title}>{children}</div>
    </section>
  );
}
