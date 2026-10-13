import { NextResponse } from "next/server";
import { ApiError, errorResponse, handleApiError, readJson } from "@/lib/api/errors";
import { limiters } from "@/lib/api/rate-limit";
import { explainSchema } from "@/lib/api/schemas";
import { explainQuestion } from "@/lib/ai/explain-service";
import { resolveAiConfig } from "@/lib/ai/provider";
import { loadRestaurantProfile } from "@/lib/data/repository";
import type { RestaurantProfile } from "@/lib/data/types";
import { clientKey } from "@/lib/security/guards";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const config = resolveAiConfig();
    const limit = Number(process.env.RATE_LIMIT_AI_PER_MINUTE ?? 20) || 20;
    const decision = limiters.ai.consume(clientKey(request), limit, 60 * 1000);
    if (!decision.allowed) {
      return errorResponse(429, "RATE_LIMITED", "The explainer is busy. Please wait a moment.", undefined, {
        "Retry-After": String(decision.retryAfterSeconds),
      });
    }

    const input = explainSchema.parse(await readJson(request));
    const asOfMs = Date.now();
    const profile = await loadRestaurantProfile(input.restaurantSlug, asOfMs);
    if (!profile) throw new ApiError(404, "NOT_FOUND", "Restaurant not found.");
    let compareProfile: RestaurantProfile | undefined;
    if (input.compareSlug) {
      compareProfile = (await loadRestaurantProfile(input.compareSlug, asOfMs)) ?? undefined;
      if (!compareProfile) throw new ApiError(404, "NOT_FOUND", "Comparison restaurant not found.");
    }

    const response = await explainQuestion({ question: input.question, profile, compareProfile, config });
    return NextResponse.json({ ...response, requestedMode: config.requestedMode, aiConfigReason: config.reason });
  } catch (error) {
    return handleApiError(error, "POST /api/ai/explain");
  }
}
