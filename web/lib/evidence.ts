// Evidence is encrypted before it goes on-chain (AES-256-GCM). Only this
// backend can decrypt it, to show it to the two parties and the reviewer and
// to send it to the AI judge. The claim itself records only a SHA-256 hash.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type Evidence = { statement: string; photo?: string | null };

function key(): Buffer {
  const secret = process.env.EVIDENCE_SECRET || process.env.NEAR_MASTER_KEY;
  if (!secret) throw new Error("Server is missing its evidence key");
  return createHash("sha256").update(`recourse-evidence:${secret}`).digest();
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Returns the canonical JSON (what gets hashed), its hash, and the ciphertext. */
export function sealEvidence(e: Evidence) {
  const plain = JSON.stringify({ statement: e.statement, photo: e.photo || null });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    plain,
    hash: sha256(plain),
    sealed: `v1.${Buffer.concat([iv, tag, ct]).toString("base64")}`,
  };
}

export function openEvidence(sealed: string | null | undefined): Evidence | null {
  if (!sealed || !sealed.startsWith("v1.")) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(plain);
  } catch {
    return null;
  }
}
