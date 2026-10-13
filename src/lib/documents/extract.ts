// Deterministic inspection-report extraction. This is the always-available path:
// it reads labelled lines from the text layer of a PDF. Everything it returns is
// marked AI_EXTRACTED / RULE_EXTRACTED — extraction is a proposal for a human
// reviewer, never a published fact.
//
// Gemini (when configured) produces the same shape through a schema-validated
// call; see src/lib/ai/gemini-extraction.ts.

import { CATEGORY_KEYS, SEVERITIES, type Severity } from "@/lib/domain";

export interface ExtractedField<T> {
  value: T | null;
  status: "EXTRACTED" | "MISSING";
  confidence: number;
  origin: "RULE_EXTRACTED" | "AI_EXTRACTED";
}

export interface ExtractedFinding {
  index: number;
  severity: Severity;
  categoryKey: string;
  description: string;
  status: "UNRESOLVED" | "RESOLVED";
  remediation: string | null;
}

export interface ExtractionResult {
  provider: "DETERMINISTIC" | "GEMINI";
  fields: {
    establishmentName: ExtractedField<string>;
    inspectionAuthority: ExtractedField<string>;
    inspectionDate: ExtractedField<string>;
    overallOutcome: ExtractedField<string>;
    referenceNumber: ExtractedField<string>;
  };
  categoriesAssessed: string[];
  findings: ExtractedFinding[];
  evidenceReferences: string[];
  missingFields: string[];
  warnings: string[];
  injectionSuspected: boolean;
  isSimulatedRecord: boolean;
}

export class ExtractionError extends Error {
  constructor(
    public readonly code: "NO_TEXT_LAYER" | "NOT_INSPECTION_REPORT" | "TEXT_TOO_LARGE",
    message: string,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

const MAX_TEXT_CHARS = 200_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Phrases that try to steer an automated reader. Their presence is reported to the
// reviewer; the text is never executed or used as instructions.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any |the )?(previous|prior|above) (instructions|prompts?)/i,
  /disregard (the )?(system|previous) (prompt|instructions)/i,
  /mark (all )?(findings|violations) as (resolved|compliant|passed)/i,
  /(you are|act as) (now )?(an? )?(assistant|ai|model)/i,
  /system prompt/i,
  /publish this (report|record) (immediately|now|automatically)/i,
];

function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ");
}

function labelled(lines: string[], label: RegExp): string | null {
  for (const line of lines) {
    const match = line.match(label);
    if (match && match[1] && match[1].trim()) return match[1].trim();
  }
  return null;
}

function field<T>(value: T | null, confidence: number): ExtractedField<T> {
  return value === null
    ? { value: null, status: "MISSING", confidence: 0, origin: "RULE_EXTRACTED" }
    : { value, status: "EXTRACTED", confidence, origin: "RULE_EXTRACTED" };
}

export function extractFromText(rawText: string): ExtractionResult {
  if (rawText.length > MAX_TEXT_CHARS) {
    throw new ExtractionError("TEXT_TOO_LARGE", "The document text is too large to analyse.");
  }
  const text = normalise(rawText);
  if (text.replace(/\s/g, "").length < 40) {
    throw new ExtractionError(
      "NO_TEXT_LAYER",
      "No readable text was found. Scanned documents need OCR, which is not available in the local demo.",
    );
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const isInspectionReport = lines.some((l) => /inspection/i.test(l)) && lines.some((l) => /inspection date|date of inspection/i.test(l) || /Inspection Date/i.test(l));
  const hasAuthorityLine = lines.some((l) => /inspection authority|authority:/i.test(l));
  if (!isInspectionReport && !hasAuthorityLine) {
    throw new ExtractionError("NOT_INSPECTION_REPORT", "This document does not look like a food safety inspection report.");
  }

  const warnings: string[] = [];
  const injectionSuspected = INJECTION_PATTERNS.some((p) => p.test(text));
  if (injectionSuspected) {
    warnings.push("Possible instruction-like text was found in the document. It was treated as data only; review it carefully.");
  }

  const establishmentName = labelled(lines, /^Establishment:\s*(.+)$/i);
  const inspectionAuthority = labelled(lines, /^Inspection Authority:\s*(.+)$/i);
  const rawDate = labelled(lines, /^Inspection Date:\s*(.+)$/i);
  const inspectionDate = rawDate && DATE_PATTERN.test(rawDate) ? rawDate : null;
  if (rawDate && !inspectionDate) warnings.push(`Inspection date "${rawDate}" is not in YYYY-MM-DD format and was not accepted.`);
  const overallOutcomeRaw = labelled(lines, /^Overall Outcome:\s*(.+)$/i);
  const overallOutcome = overallOutcomeRaw && /^(PASS WITH CONDITIONS|PASS|FAIL)$/i.test(overallOutcomeRaw.trim())
    ? overallOutcomeRaw.trim().toUpperCase().replace(/ /g, "_")
    : null;
  const referenceNumber = labelled(lines, /^Reference:\s*(.+)$/i);

  const categoriesRaw = labelled(lines, /^Assessed Categories:\s*(.+)$/i) ?? "";
  const categoriesAssessed = categoriesRaw
    .split(",")
    .map((c) => c.trim().toUpperCase().replace(/ /g, "_"))
    .filter((c) => CATEGORY_KEYS.includes(c));

  const findings: ExtractedFinding[] = [];
  const remediations = new Map<number, string>();
  for (const line of lines) {
    const remediation = line.match(/^Remediation\s+(\d+):\s*(.+)$/i);
    if (remediation) remediations.set(Number(remediation[1]), remediation[2].trim());
  }
  for (const line of lines) {
    const match = line.match(/^Finding\s+(\d+)\s*\|\s*([A-Z]+)\s*\|\s*([A-Z_]+)\s*\|\s*(.+?)\s*\|\s*Status:\s*(OPEN|CORRECTED|RESOLVED)$/i);
    if (!match) continue;
    const index = Number(match[1]);
    const severity = match[2].toUpperCase();
    const categoryKey = match[3].toUpperCase();
    if (!(SEVERITIES as readonly string[]).includes(severity)) {
      warnings.push(`Finding ${index} has an unrecognised severity "${match[2]}" and was skipped.`);
      continue;
    }
    if (!CATEGORY_KEYS.includes(categoryKey)) {
      warnings.push(`Finding ${index} has an unrecognised category "${match[3]}" and was skipped.`);
      continue;
    }
    const statusRaw = match[5].toUpperCase();
    findings.push({
      index,
      severity: severity as Severity,
      categoryKey,
      description: match[4].trim().slice(0, 500),
      status: statusRaw === "OPEN" ? "UNRESOLVED" : "RESOLVED",
      remediation: remediations.get(index) ?? null,
    });
  }

  const evidenceReferences = Array.from(
    new Set(
      lines
        .map((l) => l.match(/^(?:Reference|Attachment|Evidence):\s*(.+)$/i)?.[1]?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const fields = {
    establishmentName: field(establishmentName, establishmentName ? 0.95 : 0),
    inspectionAuthority: field(inspectionAuthority, inspectionAuthority ? 0.95 : 0),
    inspectionDate: field(inspectionDate, inspectionDate ? 0.97 : 0),
    overallOutcome: field(overallOutcome, overallOutcome ? 0.9 : 0),
    referenceNumber: field(referenceNumber, referenceNumber ? 0.9 : 0),
  };

  const missingFields = (Object.keys(fields) as Array<keyof typeof fields>).filter((k) => fields[k].value === null);
  if (categoriesAssessed.length === 0) missingFields.push("categoriesAssessed");
  if (findings.length === 0) warnings.push("No findings were found. Confirm the report genuinely contains no findings before publishing.");

  return {
    provider: "DETERMINISTIC",
    fields,
    categoriesAssessed,
    findings,
    evidenceReferences,
    missingFields,
    warnings,
    injectionSuspected,
    isSimulatedRecord: /SIMULATED RECORD/i.test(text),
  };
}
