/**
 * XML utility functions for HMRC CDS integration.
 * Provides escaping/sanitisation for values interpolated into XML payloads.
 */

/**
 * Escape user-supplied values for safe inclusion in XML.
 * Prevents XML injection by replacing all 5 XML special characters.
 * Ref: OWASP XML Security / HMRC API Security Guidelines
 */
export function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
