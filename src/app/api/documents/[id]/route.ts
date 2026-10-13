import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireDemoAdmin } from "@/lib/api/admin";
import { db } from "@/lib/data/db";

export const dynamic = "force-dynamic";

// Detail view for the review screen (demo admin). Returns the machine output and,
// separately, any human-reviewed values. The two are never merged here.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const doc = await db.evidenceDocument.findUnique({
      where: { id },
      include: { restaurant: { select: { slug: true, name: true } }, source: true, extraction: true, inspection: { select: { id: true } } },
    });
    if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found.");
    const extraction = doc.extraction
      ? {
          status: doc.extraction.status,
          provider: doc.extraction.provider,
          errorCode: doc.extraction.errorCode,
          extracted: safeParse(doc.extraction.extractedJson),
          reviewed: doc.extraction.reviewedJson ? safeParse(doc.extraction.reviewedJson) : null,
          reviewerNote: doc.extraction.reviewerNote,
          reviewedAt: doc.extraction.reviewedAt?.toISOString() ?? null,
        }
      : null;
    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        restaurantSlug: doc.restaurant.slug,
        restaurantName: doc.restaurant.name,
        sourceKey: doc.sourceKey,
        sourceLabel: doc.source.label,
        sourceTier: doc.source.tier,
        processingStatus: doc.processingStatus,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        sha256: doc.sha256,
        isSample: doc.isSample,
        publishedInspectionId: doc.inspection?.id ?? null,
        uploadedAt: doc.uploadedAt.toISOString(),
        fileHref: `/api/documents/${doc.id}/file`,
      },
      extraction,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/documents/[id]");
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
