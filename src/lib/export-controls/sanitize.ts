/** Strip control chars and cap length before LLM prompts (.cursorrules #11). */
export function sanitizeDocumentText(raw: string, maxChars = 24_000): string {
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars);
}
