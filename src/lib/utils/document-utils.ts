/**
 * Utility functions for document type inference, naming, and status normalization.
 * Moved from DocumentsPage for improved production performance and separation of concerns.
 */

export const DOCUMENT_TYPES = [
  { code: "N935", name: "Commercial invoice" },
  { code: "N271", name: "Packing list" },
  { code: "N864", name: "Certificate of origin" },
  { code: "N703", name: "Bill of lading" },
  { code: "C400", name: "Licence" },
  { code: "ZZZ", name: "Other" },
];

export function inferDocTypeCode(fileName: string): string {
  const upperName = fileName.toUpperCase();
  if (upperName.includes("INVOICE") || upperName.startsWith("INV")) return "N935";
  if (upperName.includes("PACK") || upperName.startsWith("PL-")) return "N271";
  if (upperName.includes("ORIGIN") || upperName.includes("CERT")) return "N864";
  if (upperName.includes("BOL") || upperName.includes("LADING")) return "N703";
  if (upperName.includes("LIC")) return "C400";
  return "ZZZ";
}

export function docTypeName(code: string): string {
  const map: Record<string, string> = {
    N935: "Commercial invoice",
    N271: "Packing list",
    N864: "Certificate of origin",
    N703: "Bill of lading",
    C400: "Licence",
    ZZZ: "Other",
  };
  return map[code] || "Other";
}

export function normalizeDocStatus(status: string): "verified" | "missing" | "review" {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("clean") || normalized.includes("verified") || normalized.includes("accepted")) return "verified";
  if (normalized.includes("missing")) return "missing";
  if (normalized.includes("review") || normalized.includes("flag") || normalized.includes("pending")) return "review";
  return "review";
}
