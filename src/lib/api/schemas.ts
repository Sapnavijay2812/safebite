// Request validation. Every API input passes through one of these schemas before
// it reaches the database or a model.

import { z } from "zod";
import { COMMUNITY_CATEGORIES, DOCUMENT_KINDS, FINDING_STATUSES, INSPECTION_OUTCOMES, REPORT_STATUSES, SEVERITIES, CATEGORY_KEYS } from "@/lib/domain";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.").refine((v) => !Number.isNaN(Date.parse(v)), "Not a valid date.");
const slug = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens.");
const oneLine = (max: number) => z.string().trim().min(1).max(max).regex(/^[^\u0000-\u001f]*$/, "Control characters are not allowed.");

export const restaurantListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cuisine: z.string().trim().max(60).optional(),
  neighborhood: z.string().trim().max(60).optional(),
  coverage: z.enum(["ANY", "STRONG", "GOOD", "PARTIAL", "LIMITED"]).default("ANY"),
  inspection: z.enum(["ANY", "CURRENT", "AGING", "STALE", "NONE"]).default("ANY"),
  indicator: z.enum(["ANY", "NO_OPEN_VIOLATIONS", "OPEN_CRITICAL", "HAS_DOCUMENTS"]).default("ANY"),
  sort: z.enum(["EVIDENCE", "LATEST_INSPECTION", "OPEN_VIOLATIONS", "NAME"]).default("EVIDENCE"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(9),
});

export const reportCreateSchema = z.object({
  restaurantSlug: slug,
  category: z.enum(COMMUNITY_CATEGORIES),
  description: z.string().trim().min(20, "Describe what you observed in at least 20 characters.").max(800),
  incidentDate: isoDate,
  evidenceNote: z.string().trim().max(300).optional().nullable(),
  // Honeypot: real users never fill this in. Bots often do.
  website: z.string().max(0, "Invalid submission.").optional().default(""),
});

export const moderationSchema = z.object({
  toStatus: z.enum(REPORT_STATUSES),
  note: z.string().trim().max(500).optional().default(""),
});

export const explainSchema = z.object({
  restaurantSlug: slug,
  question: z.string().trim().min(3).max(500),
  compareSlug: slug.optional(),
});

export const findingInputSchema = z.object({
  severity: z.enum(SEVERITIES),
  categoryKey: z.enum(CATEGORY_KEYS as [string, ...string[]]),
  description: oneLine(500),
  status: z.enum(FINDING_STATUSES),
  remediation: z.string().trim().max(500).optional().nullable(),
});

export const publishReviewSchema = z.object({
  restaurantSlug: slug.optional(),
  establishmentName: oneLine(120).optional().nullable(),
  inspectionAuthority: oneLine(160),
  inspectionDate: isoDate,
  overallOutcome: z.enum(INSPECTION_OUTCOMES),
  referenceNumber: z.string().trim().max(60).optional().nullable(),
  categoriesAssessed: z.array(z.enum(CATEGORY_KEYS as [string, ...string[]])).min(1).max(6),
  findings: z.array(findingInputSchema).max(50),
  reviewerNote: z.string().trim().min(5).max(500),
  // Must be explicitly true to publish. Saving a review alone never publishes.
  publish: z.boolean().default(false),
  confirmHumanReview: z.boolean().default(false),
});

export const uploadFieldsSchema = z.object({
  restaurantSlug: slug,
  title: oneLine(120),
  kind: z.enum(DOCUMENT_KINDS),
  // Uploads may only be attributed to a restaurant or an independent party.
  // Official tiers cannot be claimed by an upload; they come from authority records.
  sourceKey: z.enum(["RESTAURANT_SUBMITTED", "INDEPENDENT_AUDIT"]),
});

export const compareQuerySchema = z.object({
  slugs: z.string().max(300),
});

export type RestaurantListQuery = z.infer<typeof restaurantListQuerySchema>;
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ModerationInput = z.infer<typeof moderationSchema>;
export type ExplainInput = z.infer<typeof explainSchema>;
export type PublishReviewInput = z.infer<typeof publishReviewSchema>;
