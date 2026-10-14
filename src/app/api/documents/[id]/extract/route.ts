import { NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { requireDemoAdmin } from "@/lib/api/admin";
import { extractDocument } from "@/lib/services/documents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new ApiError(400, "VALIDATION_FAILED", "Invalid document identifier.");
    const outcome = await extractDocument(id);
    return NextResponse.json({
      status: outcome.status,
      provider: outcome.provider,
      // Labelled as machine output. Nothing here is published.
      providerLabel:
        outcome.provider === "GEMINI"
          ? "AI-extracted by Gemini on Vertex AI (grounded)"
          : outcome.fallbackCode
            ? `Rule-extracted: Vertex AI unavailable (${outcome.fallbackCode})`
            : "Rule-extracted (no AI)",
      fallbackCode: outcome.fallbackCode,
      errorCode: outcome.errorCode,
      message: outcome.message,
      extraction: outcome.result,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/documents/[id]/extract");
  }
}
