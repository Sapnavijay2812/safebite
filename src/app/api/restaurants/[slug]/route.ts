import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { loadRestaurantProfile } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new ApiError(400, "VALIDATION_FAILED", "Invalid restaurant identifier.");
    const profile = await loadRestaurantProfile(slug);
    if (!profile) throw new ApiError(404, "NOT_FOUND", "Restaurant not found.");
    return NextResponse.json({ restaurant: profile, demoData: profile.isFictional });
  } catch (error) {
    return handleApiError(error, "GET /api/restaurants/[slug]");
  }
}
