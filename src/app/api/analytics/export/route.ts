import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDemoAdmin } from "@/lib/api/admin";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { loadRestaurantProfiles } from "@/lib/data/repository";
import { buildExportRows, selectSink, toCsv, toJsonLines, BIGQUERY_SCHEMA, type ExportTable } from "@/lib/cloud/export";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  table: z.enum(Object.keys(BIGQUERY_SCHEMA) as [ExportTable, ...ExportTable[]]),
  format: z.enum(["csv", "jsonl"]).default("csv"),
});

// Downloads one export table (demo admin only).
export async function GET(request: Request) {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const { table, format } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const profiles = await loadRestaurantProfiles();
    const rows = buildExportRows(profiles, new Date().toISOString())[table];
    const body = format === "csv" ? toCsv(rows) : toJsonLines(rows);
    return new Response(body, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="safebite-${table}.${format}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/analytics/export");
  }
}

// Writes every table through the configured sink (LOCAL by default).
export async function POST() {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const profiles = await loadRestaurantProfiles();
    const rows = buildExportRows(profiles, new Date().toISOString());
    const sink = selectSink();
    const results: Record<string, { written: number; location: string }> = {};
    for (const table of Object.keys(rows) as ExportTable[]) {
      results[table] = await sink.write(table, rows[table]);
    }
    if (sink.name === "BIGQUERY" && Object.values(results).every((r) => r.written === 0)) {
      throw new ApiError(502, "UNPROCESSABLE", "No rows were accepted by the analytics sink.");
    }
    return NextResponse.json({ sink: sink.name, results });
  } catch (error) {
    return handleApiError(error, "POST /api/analytics/export");
  }
}
