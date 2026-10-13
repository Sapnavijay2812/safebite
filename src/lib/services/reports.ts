// Community reports: intake (always unverified) and moderation (state-machine guarded).

import { ApiError } from "@/lib/api/errors";
import type { ModerationInput, ReportCreateInput } from "@/lib/api/schemas";
import { db } from "@/lib/data/db";
import { DAY_MS, type ReportStatus } from "@/lib/domain";
import { validateTransition } from "@/lib/moderation/moderation";

export async function createReport(input: ReportCreateInput, submitterHash: string) {
  if (input.website) throw new ApiError(400, "VALIDATION_FAILED", "Invalid submission.");

  const restaurant = await db.restaurant.findUnique({ where: { slug: input.restaurantSlug }, select: { id: true } });
  if (!restaurant) throw new ApiError(404, "NOT_FOUND", "Restaurant not found.");

  const incident = new Date(`${input.incidentDate}T00:00:00.000Z`);
  const now = Date.now();
  if (incident.getTime() > now + DAY_MS) {
    throw new ApiError(422, "UNPROCESSABLE", "The incident date cannot be in the future.");
  }
  if (incident.getTime() < now - 3 * 365 * DAY_MS) {
    throw new ApiError(422, "UNPROCESSABLE", "Reports must describe incidents from the last three years.");
  }

  const report = await db.$transaction(async (tx) => {
    const row = await tx.communityReport.create({
      data: {
        restaurantId: restaurant.id,
        category: input.category,
        description: input.description,
        incidentDate: incident,
        status: "PENDING",
        evidenceNote: input.evidenceNote || null,
        submitterHash,
      },
    });
    await tx.auditEvent.create({
      data: {
        eventType: "REPORT_SUBMITTED",
        entityType: "CommunityReport",
        entityId: row.id,
        actor: "anonymous",
        metadata: JSON.stringify({ category: input.category, restaurant: input.restaurantSlug }),
      },
    });
    return row;
  });

  return { id: report.id, status: "PENDING" as const };
}

export async function moderateReport(reportId: string, input: ModerationInput) {
  const report = await db.communityReport.findUnique({ where: { id: reportId } });
  if (!report) throw new ApiError(404, "NOT_FOUND", "Report not found.");

  const from = report.status as ReportStatus;
  const to = input.toStatus;
  const check = validateTransition(from, to, input.note);
  if (!check.ok) throw new ApiError(422, "UNPROCESSABLE", check.reason);

  // Status change, moderation trail and audit event commit together or not at all.
  await db.$transaction(async (tx) => {
    const updated = await tx.communityReport.updateMany({
      where: { id: reportId, status: from },
      data: { status: to },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "CONFLICT", "This report was changed by someone else. Refresh and try again.");
    }
    await tx.moderationAction.create({
      data: { reportId, fromStatus: from, toStatus: to, note: input.note || "Status updated.", actor: "demo-moderator" },
    });
    await tx.auditEvent.create({
      data: {
        eventType: "REPORT_MODERATED",
        entityType: "CommunityReport",
        entityId: reportId,
        actor: "demo-moderator",
        metadata: JSON.stringify({ from, to }),
      },
    });
  });

  return { id: reportId, status: to };
}
