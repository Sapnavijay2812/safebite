// One real Gemini request on Vertex AI, to confirm your Google Cloud setup works.
//   npm run ai:smoke
// It makes a single small request, which uses a tiny amount of Vertex AI quota.
// Run it only when you want to test the live connection. Nothing runs it automatically.

import { resolveAiConfig } from "../src/lib/ai/provider";
import { callVertex } from "../src/lib/ai/vertex-client";

async function main() {
  const config = resolveAiConfig({ ...process.env, SAFEBITE_AI_MODE: "VERTEX" });
  if (config.configError) {
    console.error(`Setup problem: ${config.configError}`);
    process.exit(1);
  }
  console.log(`Calling ${config.model} on Vertex AI (project ${config.projectId}, location ${config.location})...`);

  const result = await callVertex(config, {
    systemInstruction: "Reply with JSON only, matching the schema.",
    prompt: 'Return {"ok": true, "message": "hello from Gemini"}.',
    responseSchema: {
      type: "OBJECT",
      properties: { ok: { type: "BOOLEAN" }, message: { type: "STRING" } },
      required: ["ok", "message"],
    },
  });

  if (!result.ok) {
    console.error(`FAILED with ${result.code}: ${result.detail}`);
    process.exit(1);
  }
  console.log("Live response received from Vertex AI:");
  console.log(result.text);
}

main().catch((error) => {
  console.error("Unexpected error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
