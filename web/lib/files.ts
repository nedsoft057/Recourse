// Evidence files (photos, voice notes, documents, zips). Each file is
// encrypted on the server (AES-256-GCM) before it is stored in Vercel Blob, so
// the stored copy is unreadable. The encrypted evidence on-chain holds each
// file's address, name, type, size and SHA-256, so a file can't be swapped.

import { put } from "@vercel/blob";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type Attachment = { name: string; type: string; size: number; sha256: string; url: string };

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB per request
export const MAX_FILES = 5;

function key(): Buffer {
  const secret = process.env.EVIDENCE_SECRET || process.env.NEAR_MASTER_KEY;
  if (!secret) throw new Error("Server is missing its evidence key");
  return createHash("sha256").update(`recourse-files:${secret}`).digest();
}

export async function storeFile(file: File): Promise<Attachment> {
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Each file can be up to 4 MB.");
  const plain = Buffer.from(await file.arrayBuffer());
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), ct]);
  const blob = await put(`evidence/${randomBytes(9).toString("hex")}.bin`, sealed, {
    access: "public",
    contentType: "application/octet-stream",
    addRandomSuffix: true,
  });
  return {
    name: cleanName(file.name || "file"),
    type: (file.type || "application/octet-stream").slice(0, 80),
    size: file.size,
    sha256: createHash("sha256").update(plain).digest("hex"),
    url: blob.url,
  };
}

export async function readFile(a: Attachment): Promise<Buffer> {
  const res = await fetch(a.url, { cache: "no-store" });
  if (!res.ok) throw new Error("The file couldn't be loaded.");
  const raw = Buffer.from(await res.arrayBuffer());
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
  if (createHash("sha256").update(plain).digest("hex") !== a.sha256) throw new Error("The file doesn't match its fingerprint.");
  return plain;
}

function cleanName(n: string) {
  return n.replace(/[\\/\r\n"]/g, "_").slice(-80);
}

/** Validates file references sent back by the browser. */
export function cleanAttachments(x: unknown): Attachment[] {
  if (!Array.isArray(x)) return [];
  if (x.length > MAX_FILES) throw new Error(`Attach up to ${MAX_FILES} files.`);
  return x.map((a: any) => {
    const url = String(a?.url || "");
    if (!/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/evidence\//i.test(url)) throw new Error("Unknown file.");
    if (!/^[0-9a-f]{64}$/.test(String(a?.sha256))) throw new Error("Unknown file.");
    const size = Number(a?.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) throw new Error("Unknown file.");
    return { name: cleanName(String(a?.name || "file")), type: String(a?.type || "application/octet-stream").slice(0, 80), size, sha256: a.sha256, url };
  });
}

export function kindOf(type: string) {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return "file";
}

export function fmtSize(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
