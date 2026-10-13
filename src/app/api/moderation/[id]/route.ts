import { NextResponse } from "next/server";
import { requireDemoAdmin } from "@/lib/api/admin";
import { ApiError, handleApiError, readJson } from "@/lib/api/errors";
import { moderationSchema } from "@/lib/api/schemas";
import { moderateReport } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new ApiError(400, "VALIDATION_FAILED", "Invalid report identifier.");
    const input = moderationSchema.parse(await readJson(request));
    const result = await moderateReport(id, input);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "PATCH /api/moderation/[id]");
  }
}
