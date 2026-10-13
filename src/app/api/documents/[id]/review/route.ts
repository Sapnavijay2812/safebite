import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireDemoAdmin } from "@/lib/api/admin";
import { publishReviewSchema } from "@/lib/api/schemas";
import { saveReviewAndMaybePublish } from "@/lib/services/documents";
import { readJson } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const input = publishReviewSchema.parse(await readJson(request));
    const result = await saveReviewAndMaybePublish(id, input);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "PUT /api/documents/[id]/review");
  }
}
