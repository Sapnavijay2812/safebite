// Moderation state machine for community reports. Reports are never published
// as established facts: CORROBORATED means "a moderator found supporting
// material", not "verified by an authority".

import type { ReportStatus } from "@/lib/domain";

export const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  PENDING: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["CORROBORATED", "REJECTED"],
  CORROBORATED: [],
  REJECTED: [],
};

export const MIN_MODERATION_NOTE = 10;

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function validateTransition(from: ReportStatus, to: ReportStatus, note: string | undefined): TransitionResult {
  if (!canTransition(from, to)) {
    return { ok: false, reason: `A report cannot move from ${from} to ${to}.` };
  }
  if ((to === "CORROBORATED" || to === "REJECTED") && (note ?? "").trim().length < MIN_MODERATION_NOTE) {
    return { ok: false, reason: `A moderation note of at least ${MIN_MODERATION_NOTE} characters is required to ${to.toLowerCase()} a report.` };
  }
  return { ok: true };
}

// Public visibility: only corroborated reports may be listed, and even then as
// unverified community reports. Other statuses are counted but not shown.
export function isPubliclyListable(status: ReportStatus): boolean {
  return status === "CORROBORATED";
}
