import { NextResponse } from "next/server";
import { resolveAiConfig } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

// Deliberately reports only the mode, never credential values or configuration details.
export function GET() {
  const ai = resolveAiConfig();
  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    aiMode: ai.effectiveMode,
    demoData: true,
  });
}
