// Document workflow: upload → extract → human review → publish.
// Extraction never publishes. Publishing requires an explicit reviewer
// confirmation and only creates records for inspection reports.

import { ApiError } from "@/lib/api/errors";
import type { PublishReviewInput } from "@/lib/api/schemas";
import { db } from "@/lib/data/db";
import { extractWithGemini } from "@/lib/ai/gemini-extraction";
import { resolveAiConfig } from "@/lib/ai/provider";
import { ExtractionError, extractFromText, type ExtractionResult } from "@/lib/documents/extract";
import { parsePdfText } from "@/lib/documents/pdf-text";
import { sanitizeDisplayName, validateUpload } from "@/lib/documents/upload-validation";
import { deleteStoredFile, readStoredFile, saveUpload } from "@/lib/storage/local-storage";

async function audit(eventType: string, entityId: string, metadata: Record<string, unknown>) {
  await db.auditEvent.create({
    data: { eventType, entityType: "EvidenceDocument", entityId, actor: "demo-user", metadata: JSON.stringify(metadata) },
  });
}

export async function uploadDocument(input: {
  restaurantSlug: string;
  title: string;
  kind: "INSPECTION_REPORT" | "SELF_ATTESTATION" | "AUDIT_CERTIFICATE";
  sourceKey: "RESTAURANT_SUBMITTED" | "INDEPENDENT_AUDIT";
  file: File;
  maxBytes: number;
}) {
  const restaurant = await db.restaurant.findUnique({ where: { slug: input.restaurantSlug }, select: { id: true } });
  if (!restaurant) throw new ApiError(404, "NOT_FOUND", "Restaurant not found.");

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const check = validateUpload({
    declaredMimeType: input.file.type,
    sizeBytes: input.file.size,
    head: bytes.subarray(0, 8),
    maxBytes: input.maxBytes,
  });
  if (!check.ok) {
    if (check.code === "TOO_LARGE") throw new ApiError(413, "PAYLOAD_TOO_LARGE", check.message);
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", check.message);
  }

  const stored = await saveUpload(bytes, check.ext);
  try {
    const row = await db.evidenceDocument.create({
      data: {
        restaurantId: restaurant.id,
        title: input.title,
        kind: input.kind,
        sourceKey: input.sourceKey,
        storageKey: stored.storageKey,
        originalFilename: sanitizeDisplayName(input.file.name),
        mimeType: check.mimeType,
        sizeBytes: bytes.byteLength,
        sha256: stored.sha256,
        isSample: false,
        processingStatus: "UPLOADED",
      },
    });
    await audit("DOCUMENT_UPLOADED", row.id, { kind: input.kind, sourceKey: input.sourceKey, sizeBytes: bytes.byteLength });
    return row;
  } catch (error) {
    // Keep the file system and database consistent if the insert fails.
    await deleteStoredFile(stored.storageKey);
    throw error;
  }
}

export interface ExtractionOutcome {
  status: "EXTRACTED" | "FAILED";
  provider: "DETERMINISTIC" | "GEMINI";
  result: ExtractionResult | null;
  errorCode: string | null;
  message: string | null;
}

export async function extractDocument(documentId: string): Promise<ExtractionOutcome> {
  const doc = await db.evidenceDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found.");
  if (doc.processingStatus === "PUBLISHED") {
    throw new ApiError(409, "CONFLICT", "This document is already published and cannot be re-extracted.");
  }

  const bytes = await readStoredFile(doc.storageKey);
  if (!bytes) throw new ApiError(404, "NOT_FOUND", "The stored file could not be found.");

  let failure: { code: string; message: string } | null = null;
  let text = "";
  if (doc.mimeType !== "application/pdf") {
    failure = { code: "OCR_UNAVAILABLE", message: "Images need OCR, which is not available in the local demo. Upload a PDF with a text layer." };
  } else {
    try {
      text = await parsePdfText(bytes);
    } catch (error) {
      failure = error instanceof ExtractionError
        ? { code: error.code, message: error.message }
        : { code: "PDF_UNREADABLE", message: "The PDF could not be read. It may be damaged or password protected." };
    }
  }

  let result: ExtractionResult | null = null;
  let provider: "DETERMINISTIC" | "GEMINI" = "DETERMINISTIC";
  if (!failure) {
    try {
      // Gemini is used only when configured and grounded; otherwise the rule-based path runs.
      const config = resolveAiConfig();
      const modelResult = config.effectiveMode === "DEMO" ? null : await extractWithGemini(config, text);
      if (modelResult) {
        result = modelResult;
        provider = "GEMINI";
      } else {
        result = extractFromText(text);
      }
    } catch (error) {
      failure = error instanceof ExtractionError
        ? { code: error.code, message: error.message }
        : { code: "EXTRACTION_FAILED", message: "Extraction failed. Try again or review the document manually." };
    }
  }

  const status = failure ? "FAILED" : "EXTRACTED";
  const storedProvider = failure ? "DETERMINISTIC" : provider;
  await db.$transaction(async (tx) => {
    await tx.documentExtraction.upsert({
      where: { documentId },
      create: {
        documentId,
        status,
        provider: storedProvider,
        extractedJson: JSON.stringify(result ?? {}),
        errorCode: failure?.code ?? null,
      },
      update: {
        status,
        provider: storedProvider,
        extractedJson: JSON.stringify(result ?? {}),
        errorCode: failure?.code ?? null,
        reviewedJson: null,
        reviewedAt: null,
      },
    });
    await tx.evidenceDocument.update({
      where: { id: documentId },
      data: { processingStatus: failure ? "UPLOADED" : "EXTRACTED" },
    });
  });
  await audit("DOCUMENT_EXTRACTED", documentId, { status, provider: storedProvider, errorCode: failure?.code ?? null });

  return {
    status,
    provider: storedProvider,
    result,
    errorCode: failure?.code ?? null,
    message: failure?.message ?? null,
  };
}

export async function saveReviewAndMaybePublish(documentId: string, input: PublishReviewInput) {
  const doc = await db.evidenceDocument.findUnique({
    where: { id: documentId },
    include: { extraction: true },
  });
  if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found.");
  if (doc.processingStatus === "PUBLISHED") throw new ApiError(409, "CONFLICT", "This document is already published.");
  if (!doc.extraction || doc.extraction.status === "FAILED" || doc.extraction.status === "PENDING") {
    throw new ApiError(422, "UNPROCESSABLE", "Run extraction successfully before reviewing this document.");
  }
  if (input.publish) {
    if (!input.confirmHumanReview) {
      throw new ApiError(422, "UNPROCESSABLE", "Confirm that you have checked every field against the document before publishing.");
    }
    if (doc.kind !== "INSPECTION_REPORT") {
      throw new ApiError(422, "UNPROCESSABLE", "Only inspection reports can be published as inspection records. Other document types stay as reviewed evidence.");
    }
  }

  const inspectionDate = new Date(`${input.inspectionDate}T00:00:00.000Z`);
  if (Number.isNaN(inspectionDate.getTime()) || inspectionDate.getTime() > Date.now() + 86_400_000) {
    throw new ApiError(422, "UNPROCESSABLE", "The inspection date must be a real date that is not in the future.");
  }

  await db.$transaction(async (tx) => {
    await tx.documentExtraction.update({
      where: { documentId },
      data: {
        status: "REVIEWED",
        reviewedJson: JSON.stringify(input),
        reviewerNote: input.reviewerNote,
        reviewedAt: new Date(),
      },
    });
    if (input.publish) {
      await tx.inspection.create({
        data: {
          restaurantId: doc.restaurantId,
          inspectedAt: inspectionDate,
          authorityName: input.inspectionAuthority,
          sourceKey: doc.sourceKey,
          outcome: input.overallOutcome,
          summary: `Published after human review of the uploaded document "${doc.title}".`,
          isSimulated: false,
          documentId: doc.id,
          categories: { create: input.categoriesAssessed.map((categoryKey) => ({ categoryKey })) },
          findings: {
            create: input.findings.map((f) => ({
              categoryKey: f.categoryKey,
              severity: f.severity,
              description: f.description,
              status: f.status,
              remediation: f.remediation ?? null,
            })),
          },
        },
      });
      await tx.evidenceDocument.update({ where: { id: documentId }, data: { processingStatus: "PUBLISHED" } });
    }
  });

  await audit(input.publish ? "DOCUMENT_PUBLISHED" : "DOCUMENT_REVIEWED", documentId, {
    findings: input.findings.length,
    categories: input.categoriesAssessed.length,
  });
  return { published: input.publish, reviewedAt: new Date().toISOString() };
}
