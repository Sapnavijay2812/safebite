import { NextResponse } from "next/server";
import { ApiError, errorResponse, handleApiError } from "@/lib/api/errors";
import { requireDemoAdmin } from "@/lib/api/admin";
import { limiters } from "@/lib/api/rate-limit";
import { uploadFieldsSchema } from "@/lib/api/schemas";
import { db } from "@/lib/data/db";
import { DEFAULT_MAX_UPLOAD_BYTES } from "@/lib/documents/upload-validation";
import { uploadDocument } from "@/lib/services/documents";
import { clientKey } from "@/lib/security/guards";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES) || DEFAULT_MAX_UPLOAD_BYTES;

// Listing is demo-admin only: uploaded documents are unreviewed until published.
export async function GET(request: Request) {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const page = z.coerce.number().int().min(1).max(10_000).catch(1).parse(new URL(request.url).searchParams.get("page") ?? 1);
    const pageSize = 20;
    const [total, rows] = await Promise.all([
      db.evidenceDocument.count(),
      db.evidenceDocument.findMany({
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { restaurant: { select: { slug: true, name: true } }, source: { select: { label: true, tier: true } }, extraction: { select: { status: true, provider: true, errorCode: true } } },
      }),
    ]);
    return NextResponse.json({
      items: rows.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        restaurantSlug: d.restaurant.slug,
        restaurantName: d.restaurant.name,
        sourceLabel: d.source.label,
        sourceTier: d.source.tier,
        processingStatus: d.processingStatus,
        isSample: d.isSample,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.uploadedAt.toISOString(),
        extraction: d.extraction ? { status: d.extraction.status, provider: d.extraction.provider, errorCode: d.extraction.errorCode } : null,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return handleApiError(error, "GET /api/documents");
  }
}

export async function POST(request: Request) {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const decision = limiters.uploads.consume(clientKey(request), Number(process.env.RATE_LIMIT_UPLOADS_PER_HOUR ?? 20), 60 * 60 * 1000);
    if (!decision.allowed) {
      return errorResponse(429, "RATE_LIMITED", "Too many uploads. Please wait before trying again.", undefined, {
        "Retry-After": String(decision.retryAfterSeconds),
      });
    }

    const form = await request.formData().catch(() => null);
    if (!form) throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Upload the document as multipart form data.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "VALIDATION_FAILED", "Choose a file to upload.");
    if (file.size > MAX_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The file is too large.");

    const fields = uploadFieldsSchema.parse({
      restaurantSlug: form.get("restaurantSlug"),
      title: form.get("title") || file.name,
      kind: form.get("kind"),
      sourceKey: form.get("sourceKey"),
    });

    const row = await uploadDocument({ ...fields, file, maxBytes: MAX_BYTES });
    return NextResponse.json({ id: row.id, processingStatus: row.processingStatus }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/documents");
  }
}
