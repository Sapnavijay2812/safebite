// Upload validation. The declared MIME type is never trusted on its own: the
// first bytes (magic numbers) must match the declared type, and size limits are
// enforced before anything is written to disk.

export const ALLOWED_UPLOAD_TYPES = {
  "application/pdf": { ext: "pdf", signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  "image/png": { ext: "png", signature: [0x89, 0x50, 0x4e, 0x47] },
  "image/jpeg": { ext: "jpg", signature: [0xff, 0xd8, 0xff] },
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_UPLOAD_TYPES;

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadRejection = "EMPTY" | "TOO_LARGE" | "UNSUPPORTED_TYPE" | "SIGNATURE_MISMATCH";

export type UploadValidation =
  | { ok: true; mimeType: AllowedMimeType; ext: string }
  | { ok: false; code: UploadRejection; message: string };

export function validateUpload(input: {
  declaredMimeType: string;
  sizeBytes: number;
  head: Uint8Array;
  maxBytes?: number;
}): UploadValidation {
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  if (input.sizeBytes <= 0) {
    return { ok: false, code: "EMPTY", message: "The file is empty." };
  }
  if (input.sizeBytes > maxBytes) {
    return { ok: false, code: "TOO_LARGE", message: `Files must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.` };
  }
  const declared = input.declaredMimeType as AllowedMimeType;
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_UPLOAD_TYPES, declared)) {
    return { ok: false, code: "UNSUPPORTED_TYPE", message: "Only PDF, PNG and JPEG files are accepted." };
  }
  const spec = ALLOWED_UPLOAD_TYPES[declared];
  const matches = spec.signature.every((byte, index) => input.head[index] === byte);
  if (!matches) {
    return {
      ok: false,
      code: "SIGNATURE_MISMATCH",
      message: "The file content does not match its type. It may be corrupt or mislabelled.",
    };
  }
  return { ok: true, mimeType: declared, ext: spec.ext };
}

// Display names are cosmetic only. They are never used to build file paths.
export function sanitizeDisplayName(name: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._ ()-]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "document";
}
