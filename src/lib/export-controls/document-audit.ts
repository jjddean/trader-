import type { ExportExtractionResult } from "./extraction";

export interface AuditRisk {
  type: string;
  field: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface DocumentAuditResult {
  status: "passed" | "flagged";
  riskChecklist: AuditRisk[];
  extractedData?: ExportExtractionResult;
}

const DUAL_USE_KEYWORDS =
  /\b(encryption|cryptograph|dual[\s-]?use|missile|radar|night[\s-]?vision|thermal imaging|uav|drone|laser|semiconductor|fpga|gpu|accelerator)\b/i;

export function runDocumentAudit(
  rawText: string,
  docType: string,
  extracted?: ExportExtractionResult,
): DocumentAuditResult {
  const risks: AuditRisk[] = [];
  const text = rawText.trim();

  if (text.length < 40) {
    risks.push({
      type: "structure",
      field: "content",
      severity: "high",
      message: "Document text is too short for a reliable export-control review.",
    });
  }

  if (!/\b(consignee|ship to|deliver to|buyer|customer)\b/i.test(text)) {
    risks.push({
      type: "parties",
      field: "consignee",
      severity: "medium",
      message: "No consignee or buyer identified — required for export licensing.",
    });
  }

  if (!/\b(end[\s-]?user|ultimate consignee|intended use|end use)\b/i.test(text)) {
    risks.push({
      type: "parties",
      field: "end_user",
      severity: "medium",
      message: "End-user or intended-use information not found — may be required for controlled goods.",
    });
  }

  if (!/\b(destination|country of destination|deliver to|ship to)\b/i.test(text) && !extracted?.shipment.destinationCountry) {
    risks.push({
      type: "routing",
      field: "destination",
      severity: "medium",
      message: "Destination country not clearly stated.",
    });
  }

  if (docType === "commercial_invoice" && !/\b(invoice|total|amount|value|price)\b/i.test(text)) {
    risks.push({
      type: "structure",
      field: "invoice",
      severity: "low",
      message: "Commercial invoice may be missing value or invoice identifiers.",
    });
  }

  if (DUAL_USE_KEYWORDS.test(text)) {
    risks.push({
      type: "export_control",
      field: "product_description",
      severity: "high",
      message: "Document mentions terms associated with dual-use or controlled goods — export control review recommended.",
    });
  }

  if (extracted) {
    if (!extracted.shipment.endUser.name) {
      risks.push({
        type: "extraction",
        field: "end_user",
        severity: "medium",
        message: "AI extraction could not identify an end user.",
      });
    }
    if (extracted.products.length === 0) {
      risks.push({
        type: "extraction",
        field: "products",
        severity: "high",
        message: "No products extracted — check document quality or format.",
      });
    }
    for (const field of extracted.missingFields) {
      risks.push({
        type: "extraction",
        field,
        severity: "low",
        message: `Missing field flagged by extractor: ${field}`,
      });
    }
  }

  const hasHigh = risks.some((r) => r.severity === "high");
  return {
    status: hasHigh || risks.length >= 3 ? "flagged" : risks.length > 0 ? "flagged" : "passed",
    riskChecklist: risks,
    extractedData: extracted,
  };
}
