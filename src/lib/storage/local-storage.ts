// Local evidence storage. Files are written under a single upload folder with
// random names; user-supplied names are never used in paths. The Cloud Storage
// adapter (docs/GOOGLE_CLOUD.md) would replace these two functions.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeStorageKey } from "@/lib/security/guards";

const PROJECT_ROOT = process.cwd();

function uploadDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim() || "data/uploads";
  const resolved = path.resolve(PROJECT_ROOT, configured);
  // The upload folder must stay inside the project; refuse anything else.
  if (!resolved.startsWith(PROJECT_ROOT + path.sep)) {
    throw new Error("UPLOAD_DIR must resolve inside the project directory.");
  }
  return resolved;
}

function sampleDir(): string {
  return path.resolve(PROJECT_ROOT, "public");
}

export function resolveStoragePath(storageKey: string): string | null {
  if (!isSafeStorageKey(storageKey)) return null;
  const [folder] = storageKey.split("/");
  const base = folder === "samples" ? sampleDir() : uploadDir();
  const absolute = path.resolve(base, storageKey);
  // Final containment check: the resolved path must remain inside its base folder.
  if (!absolute.startsWith(base + path.sep)) return null;
  return absolute;
}

export async function saveUpload(bytes: Uint8Array, ext: string): Promise<{ storageKey: string; sha256: string }> {
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(path.join(dir, name), bytes, { flag: "wx" });
  return { storageKey: `uploads/${name}`, sha256 };
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  const absolute = resolveStoragePath(storageKey);
  if (!absolute) return;
  await unlink(absolute).catch(() => undefined);
}

export async function readStoredFile(storageKey: string): Promise<Buffer | null> {
  const absolute = resolveStoragePath(storageKey);
  if (!absolute) return null;
  return readFile(absolute).catch(() => null);
}
