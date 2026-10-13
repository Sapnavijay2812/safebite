// View types returned by the repository. These are the only shapes that leave the
// server, so no raw database rows or internal storage keys are exposed.

import type { EvidenceTier, ReportStatus, Severity } from "@/lib/domain";
import type { TransparencyResult } from "@/lib/scoring/transparency";

export interface LocationView {
  addressLine: string;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface FindingView {
  id: string;
  inspectionId: string;
  inspectedAt: string;
  categoryKey: string;
  categoryLabel: string;
  severity: Severity;
  description: string;
  status: "UNRESOLVED" | "RESOLVED";
  remediation: string | null;
  resolvedAt: string | null;
  tier: EvidenceTier;
  sourceLabel: string;
}

export interface InspectionView {
  id: string;
  inspectedAt: string;
  authorityName: string;
  sourceKey: string;
  sourceLabel: string;
  tier: EvidenceTier;
  outcome: string;
  summary: string;
  isSimulated: boolean;
  categories: string[];
  findings: FindingView[];
}

export interface DocumentView {
  id: string;
  title: string;
  kind: string;
  sourceKey: string;
  sourceLabel: string;
  tier: EvidenceTier;
  issuedAt: string | null;
  uploadedAt: string;
  isSample: boolean;
  processingStatus: string;
  originalFilename: string;
  sizeBytes: number;
  href: string;
  claims: Array<{ categoryKey: string; claimsCompliant: boolean }>;
}

export interface CommunityReportView {
  id: string;
  category: string;
  status: ReportStatus;
  incidentDate: string;
  // Only populated for corroborated reports; other statuses never expose text.
  description: string | null;
}

export interface RestaurantProfile {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  priceTier: number;
  description: string;
  accentColor: string;
  isFictional: boolean;
  location: LocationView;
  inspections: InspectionView[];
  latestInspection: InspectionView | null;
  openOfficialFindings: FindingView[];
  documents: DocumentView[];
  communityReports: CommunityReportView[];
  communityCounts: Record<ReportStatus, number>;
  transparency: TransparencyResult;
  missingInformation: string[];
}
