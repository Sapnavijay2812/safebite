import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireDemoAdmin } from "@/lib/api/admin";
import { db } from "@/lib/data/db";
import { readStoredFile } from "@/lib/storage/local-storage";

export const dynamic = "force-dynamic";

// Streams a stored document. Samples and published documents are public; unreviewed
// uploads require the demo-admin gate. Paths are resolved only through storageKey.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new ApiError(400, "VALIDATION_FAILED", "Invalid document identifier.");
    const doc = await db.evidenceDocument.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, originalFilename: true, processingStatus: true, isSample: true } });
    if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found.");
    if (!doc.isSample && doc.processingStatus !== "PUBLISHED") {
      const denied = requireDemoAdmin();
      if (denied) return denied;
    }
    const bytes = await readStoredFile(doc.storageKey);
    if (!bytes) throw new ApiError(404, "NOT_FOUND", "The stored file could not be found.");
    const safeName = doc.originalFilename.replace(/[^A-Za-z0-9._ -]/g, "_");
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/documents/[id]/file");
  }
}
