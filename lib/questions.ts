import { createHash } from "node:crypto";

// Same text always produces the same hash, so duplicates across papers collapse into one row.
export function normaliseQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashQuestion(text: string): string {
  return createHash("sha256").update(normaliseQuestion(text)).digest("hex").slice(0, 32);
}

// Cheap guard before saving extracted questions.
export function looksGarbled(text: string): boolean {
  if (text.trim().length < 8) return true;
  const letters = (text.match(/[a-zA-Z]/g) ?? []).length;
  const ratio = letters / text.length;
  if (ratio < 0.4) return true;
  // Long runs of symbols or replacement characters are usually broken OCR.
  return /[�]{1,}|[^\w\s,.;:()\-+/=%°'"?]{6,}/.test(text);
}
