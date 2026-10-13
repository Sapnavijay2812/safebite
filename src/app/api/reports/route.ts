import { NextResponse } from "next/server";
import { errorResponse, handleApiError, readJson } from "@/lib/api/errors";
import { limiters } from "@/lib/api/rate-limit";
import { reportCreateSchema } from "@/lib/api/schemas";
import { db } from "@/lib/data/db";
import { createReport } from "@/lib/services/reports";
import { hashSubmitter, clientKey } from "@/lib/security/guards";

export const dynamic = "force-dynamic";

// Public listing: only corroborated reports, and always labelled unverified.
export async function GET() {
  try {
    const [counts, rows] = await Promise.all([
      db.communityReport.groupBy({ by: ["status"], _count: { _all: true } }),
      db.communityReport.findMany({
        where: { status: "CORROBORATED" },
        orderBy: { incidentDate: "desc" },
        take: 50,
        include: { restaurant: { select: { slug: true, name: true } } },
      }),
    ]);
    return NextResponse.json({
      verificationNotice: "Community reports are unverified. Corroborated reports are moderator-reviewed allegations, not official findings.",
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      items: rows.map((r) => ({
        id: r.id,
        restaurantSlug: r.restaurant.slug,
        restaurantName: r.restaurant.name,
        category: r.category,
        incidentDate: r.incidentDate.toISOString().slice(0, 10),
        description: r.description,
        status: r.status,
      })),
    });
  } catch (error) {
    return handleApiError(error, "GET /api/reports");
  }
}

export async function POST(request: Request) {
  try {
    const decision = limiters.reports.consume(clientKey(request), Number(process.env.RATE_LIMIT_REPORTS_PER_HOUR ?? 5), 60 * 60 * 1000);
    if (!decision.allowed) {
      return errorResponse(429, "RATE_LIMITED", "You have sent several reports recently. Please try again later.", undefined, {
        "Retry-After": String(decision.retryAfterSeconds),
      });
    }
    const input = reportCreateSchema.parse(await readJson(request));
    const created = await createReport(input, hashSubmitter(request));
    return NextResponse.json({ ...created, message: "Thanks. Your report was saved as unverified and will be reviewed before anything is shown publicly." }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/reports");
  }
}
