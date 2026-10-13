import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { compareQuerySchema } from "@/lib/api/schemas";
import { buildComparison, parseCompareSlugs } from "@/lib/compare/compare";
import { toCompareSubject } from "@/lib/compare/subjects";
import { loadRestaurantProfile } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { slugs } = compareQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const parsed = parseCompareSlugs(slugs);
    if (!parsed.ok) throw new ApiError(400, "VALIDATION_FAILED", parsed.reason);
    const asOfMs = Date.now();
    const profiles = await Promise.all(parsed.slugs.map((slug) => loadRestaurantProfile(slug, asOfMs)));
    const missing = parsed.slugs.filter((_, i) => profiles[i] === null);
    if (missing.length) throw new ApiError(404, "NOT_FOUND", `Restaurant not found: ${missing.join(", ")}`);
    const subjects = profiles.map((p) => toCompareSubject(p!, asOfMs));
    return NextResponse.json(buildComparison(subjects));
  } catch (error) {
    return handleApiError(error, "GET /api/compare");
  }
}
