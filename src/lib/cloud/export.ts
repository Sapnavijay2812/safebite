// Export-ready tables and analytics sinks.
//
// The row shapes below are the BigQuery schema (see docs/GOOGLE_CLOUD.md and
// BIGQUERY_SCHEMA). Local demos write JSON Lines files; the BigQuery sink is only
// used when ANALYTICS_SINK=BIGQUERY and credentials are provided. Nothing is sent
// to Google Cloud by default.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RestaurantProfile } from "@/lib/data/types";

export const BIGQUERY_SCHEMA = {
  restaurants: [
    { name: "restaurant_slug", type: "STRING", mode: "REQUIRED" },
    { name: "name", type: "STRING", mode: "REQUIRED" },
    { name: "cuisine", type: "STRING", mode: "REQUIRED" },
    { name: "neighborhood", type: "STRING", mode: "NULLABLE" },
    { name: "is_fictional", type: "BOOLEAN", mode: "REQUIRED" },
    { name: "evidence_confidence", type: "INT64", mode: "REQUIRED" },
    { name: "evidence_label", type: "STRING", mode: "REQUIRED" },
    { name: "latest_official_inspection_date", type: "DATE", mode: "NULLABLE" },
    { name: "unresolved_critical", type: "INT64", mode: "REQUIRED" },
    { name: "unresolved_major", type: "INT64", mode: "REQUIRED" },
    { name: "document_count", type: "INT64", mode: "REQUIRED" },
    { name: "as_of", type: "TIMESTAMP", mode: "REQUIRED" },
  ],
  inspection_findings: [
    { name: "restaurant_slug", type: "STRING", mode: "REQUIRED" },
    { name: "inspection_date", type: "DATE", mode: "REQUIRED" },
    { name: "tier", type: "STRING", mode: "REQUIRED" },
    { name: "category", type: "STRING", mode: "REQUIRED" },
    { name: "severity", type: "STRING", mode: "REQUIRED" },
    { name: "status", type: "STRING", mode: "REQUIRED" },
  ],
  evidence_documents: [
    { name: "restaurant_slug", type: "STRING", mode: "REQUIRED" },
    { name: "kind", type: "STRING", mode: "REQUIRED" },
    { name: "source_tier", type: "STRING", mode: "REQUIRED" },
    { name: "processing_status", type: "STRING", mode: "REQUIRED" },
    { name: "is_sample", type: "BOOLEAN", mode: "REQUIRED" },
    { name: "size_bytes", type: "INT64", mode: "REQUIRED" },
  ],
} as const;

export type ExportTable = keyof typeof BIGQUERY_SCHEMA;

export function buildExportRows(profiles: RestaurantProfile[], asOfIso: string): Record<ExportTable, Array<Record<string, string | number | boolean | null>>> {
  return {
    restaurants: profiles.map((p) => ({
      restaurant_slug: p.slug,
      name: p.name,
      cuisine: p.cuisine,
      neighborhood: p.location.neighborhood,
      is_fictional: p.isFictional,
      evidence_confidence: p.transparency.score,
      evidence_label: p.transparency.label,
      latest_official_inspection_date: p.latestInspection && p.transparency.latestOfficialInspectionMs !== null ? p.latestInspection.inspectedAt : null,
      unresolved_critical: p.transparency.unresolvedOfficial.critical,
      unresolved_major: p.transparency.unresolvedOfficial.major,
      document_count: p.documents.length,
      as_of: asOfIso,
    })),
    inspection_findings: profiles.flatMap((p) =>
      p.inspections.flatMap((i) =>
        i.findings.map((f) => ({
          restaurant_slug: p.slug,
          inspection_date: i.inspectedAt,
          tier: f.tier,
          category: f.categoryKey,
          severity: f.severity,
          status: f.status,
        })),
      ),
    ),
    evidence_documents: profiles.flatMap((p) =>
      p.documents.map((d) => ({
        restaurant_slug: p.slug,
        kind: d.kind,
        source_tier: d.tier,
        processing_status: d.processingStatus,
        is_sample: d.isSample,
        size_bytes: d.sizeBytes,
      })),
    ),
  };
}

export function toJsonLines(rows: Array<Record<string, unknown>>): string {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    // Neutralise spreadsheet formula injection, then quote.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n") + "\n";
}

export interface AnalyticsSink {
  name: "LOCAL" | "BIGQUERY";
  write(table: ExportTable, rows: Array<Record<string, unknown>>): Promise<{ written: number; location: string }>;
}

export function createLocalSink(root: string = process.cwd()): AnalyticsSink {
  return {
    name: "LOCAL",
    async write(table, rows) {
      const dir = path.join(root, "data", "exports");
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${table}.jsonl`);
      await writeFile(file, toJsonLines(rows));
      return { written: rows.length, location: path.relative(root, file) };
    },
  };
}

// Optional adapter. It is inert unless the environment selects BIGQUERY and provides a
// project, dataset and access token. Each table must already exist with BIGQUERY_SCHEMA.
export function createBigQuerySink(env: NodeJS.ProcessEnv = process.env): AnalyticsSink | null {
  const projectId = env.BIGQUERY_PROJECT_ID?.trim();
  const dataset = env.BIGQUERY_DATASET?.trim() || "safebite_analytics";
  const token = env.BIGQUERY_ACCESS_TOKEN?.trim();
  if (!projectId || !token) return null;
  return {
    name: "BIGQUERY",
    async write(table, rows) {
      const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${dataset}/tables/${table}/insertAll`;
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rows.map((json) => ({ json })) }),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`BigQuery insertAll failed with HTTP ${response.status}`);
      return { written: rows.length, location: `${projectId}.${dataset}.${table}` };
    },
  };
}

export function selectSink(env: NodeJS.ProcessEnv = process.env): AnalyticsSink {
  if ((env.ANALYTICS_SINK ?? "LOCAL").toUpperCase() === "BIGQUERY") {
    const bigQuery = createBigQuerySink(env);
    if (bigQuery) return bigQuery;
  }
  return createLocalSink();
}
