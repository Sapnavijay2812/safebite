// Shared domain vocabulary. Keep these lists the single source of truth:
// the Prisma schema stores strings, and every write is validated against them.

export const EVIDENCE_TIERS = [
  "OFFICIAL_VERIFIED",
  "INDEPENDENT_CHECK",
  "SELF_REPORTED",
  "UNVERIFIED_ALLEGATION",
  "AI_INFERRED",
] as const;
export type EvidenceTier = (typeof EVIDENCE_TIERS)[number];

export const TIER_LABELS: Record<EvidenceTier, { label: string; description: string }> = {
  OFFICIAL_VERIFIED: {
    label: "Official verified",
    description:
      "Record from a food safety authority. Demo copies are simulated and are not real authority records.",
  },
  INDEPENDENT_CHECK: {
    label: "Independently checked",
    description: "Audit or check performed by a party other than the restaurant or the authority.",
  },
  SELF_REPORTED: {
    label: "Self-reported",
    description: "Submitted by the restaurant. Counts toward coverage, but is not independently verified.",
  },
  UNVERIFIED_ALLEGATION: {
    label: "Unverified allegation",
    description: "Customer report that has not been verified. Never scored and never shown as established fact.",
  },
  AI_INFERRED: {
    label: "AI-inferred signal",
    description: "Machine-generated interpretation. Never scored and never a certification or safety rating.",
  },
};

export const SEVERITIES = ["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_STATUSES = ["UNRESOLVED", "RESOLVED"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const INSPECTION_OUTCOMES = ["PASS", "PASS_WITH_CONDITIONS", "FAIL"] as const;
export type InspectionOutcome = (typeof INSPECTION_OUTCOMES)[number];

export const HYGIENE_CATEGORIES = [
  {
    key: "FOOD_STORAGE",
    label: "Food storage",
    description: "Labelling, date marking, separation and off-floor storage of ingredients.",
  },
  {
    key: "TEMPERATURE_CONTROL",
    label: "Temperature controls",
    description: "Hot and cold holding, cooling logs and refrigeration performance.",
  },
  {
    key: "CLEANLINESS",
    label: "Cleanliness",
    description: "Cleaning schedules, sanitiser concentration and surface condition.",
  },
  {
    key: "PEST_MANAGEMENT",
    label: "Pest management",
    description: "Pest control contracts, sightings records and exclusion measures.",
  },
  {
    key: "STAFF_HYGIENE",
    label: "Staff hygiene",
    description: "Handwashing facilities, illness reporting and protective clothing.",
  },
  {
    key: "CROSS_CONTAMINATION",
    label: "Cross-contamination prevention",
    description: "Allergen and raw/ready-to-eat separation, colour-coded equipment and utensils.",
  },
] as const;

export type CategoryKey = (typeof HYGIENE_CATEGORIES)[number]["key"];
export const CATEGORY_KEYS: readonly string[] = HYGIENE_CATEGORIES.map((c) => c.key);

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  HYGIENE_CATEGORIES.map((c) => [c.key, c.label]),
);

export const COMMUNITY_CATEGORIES = [...CATEGORY_KEYS, "OTHER"] as const;

export const REPORT_STATUSES = ["PENDING", "UNDER_REVIEW", "CORROBORATED", "REJECTED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const DOCUMENT_KINDS = ["INSPECTION_REPORT", "SELF_ATTESTATION", "AUDIT_CERTIFICATE"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = ["UPLOADED", "EXTRACTED", "PUBLISHED", "REJECTED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EXTRACTION_STATUSES = ["PENDING", "EXTRACTED", "FAILED", "REVIEWED"] as const;
export const EXTRACTION_PROVIDERS = ["DETERMINISTIC", "GEMINI"] as const;

export const DEMO_DATA_LABEL = "Demo data — fictional restaurants and simulated inspection records";

export const DISCLAIMER =
  "SafeBite is an informational platform. It is not a government certification authority and does not issue hygiene certifications or safety ratings. Evidence confidence measures how much verifiable information is available, not how safe a restaurant is.";

export function isOneOf<T extends readonly string[]>(list: T, value: unknown): value is T[number] {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export const DAY_MS = 86_400_000;
