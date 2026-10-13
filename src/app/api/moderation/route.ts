import { NextResponse } from "next/server";
import { requireDemoAdmin } from "@/lib/api/admin";
import { handleApiError } from "@/lib/api/errors";
import { db } from "@/lib/data/db";

export const dynamic = "force-dynamic";

// Demo moderation queue (demo admin only). Includes every status so moderators can act.
export async function GET() {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const rows = await db.communityReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        restaurant: { select: { slug: true, name: true } },
        moderation: { orderBy: { createdAt: "asc" }, select: { fromStatus: true, toStatus: true, note: true, createdAt: true } },
      },
    });
    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        restaurantSlug: r.restaurant.slug,
        restaurantName: r.restaurant.name,
        category: r.category,
        description: r.description,
        incidentDate: r.incidentDate.toISOString().slice(0, 10),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        trail: r.moderation.map((m) => ({ from: m.fromStatus, to: m.toStatus, note: m.note, at: m.createdAt.toISOString() })),
      })),
    });
  } catch (error) {
    return handleApiError(error, "GET /api/moderation");
  }
}
