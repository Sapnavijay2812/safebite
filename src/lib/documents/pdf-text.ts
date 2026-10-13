// Text-layer extraction for PDFs. Uses pdf-parse's core module directly so that
// the package's debug entry point (which reads a test file on import) is avoided.
// Server-only: never import this from a client component.

import { ExtractionError } from "./extract";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 30;

export async function parsePdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new ExtractionError("TEXT_TOO_LARGE", "The PDF is too large to analyse.");
  }
  const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as {
    default: (data: Buffer, options?: { max?: number }) => Promise<{ text: string; numpages: number }>;
  };
  const parse = mod.default ?? (mod as unknown as typeof mod.default);
  const result = await parse(Buffer.from(bytes), { max: MAX_PAGES });
  return result.text ?? "";
}
