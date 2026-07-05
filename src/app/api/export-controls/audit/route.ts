import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { aiExtractLimiter } from "@/lib/api-rate-limiter";
import { sanitizeDocumentText } from "@/lib/export-controls/sanitize";
import { extractExportFactsFromText } from "@/lib/export-controls/extraction";
import { runDocumentAudit } from "@/lib/export-controls/document-audit";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!aiExtractLimiter.tryConsume(userId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const rawText = typeof body.rawText === "string" ? body.rawText : "";
    const docType = typeof body.docType === "string" ? body.docType : "commercial_invoice";
    const documentId = typeof body.documentId === "string" ? body.documentId : undefined;
    const runExtraction = body.runExtraction !== false;

    if (!rawText.trim()) {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const sanitized = sanitizeDocumentText(rawText);

    let extracted;
    if (runExtraction && process.env.GROQ_API_KEY) {
      try {
        extracted = await extractExportFactsFromText(sanitized);
      } catch (err) {
        console.warn("Export facts extraction failed during audit:", err);
      }
    }

    const audit = runDocumentAudit(sanitized, docType, extracted);

    if (documentId) {
      const convexToken = await getToken({ template: "convex" });
      if (convexToken) {
        convex.setAuth(convexToken);
        try {
          await convex.mutation(api.documents.recordDocumentAudit, {
            documentId: documentId as Id<"documents">,
            auditStatus: audit.status,
            auditResult: audit,
            ocrText: sanitized,
          });
        } catch (err) {
          console.warn("Failed to persist document audit:", err);
        }
      }
    }

    const assessmentIdRaw = typeof body.assessmentId === "string" ? body.assessmentId : undefined;
    if (extracted && assessmentIdRaw) {
      const convexToken = await getToken({ template: "convex" });
      if (convexToken) {
        convex.setAuth(convexToken);
        try {
          await convex.mutation(api.export_controls.persistExtraction, {
            assessmentId: assessmentIdRaw as Id<"export_assessments">,
            destinationCountry: extracted.shipment.destinationCountry ?? undefined,
            consignee: extracted.shipment.consignee,
            endUser: extracted.shipment.endUser,
            intendedUse: extracted.shipment.intendedUse ?? undefined,
            sourceDocumentId: documentId ? (documentId as Id<"documents">) : undefined,
            products: extracted.products.map((p) => ({
              name: p.productName,
              manufacturer: p.manufacturer ?? undefined,
              modelNo: p.modelNo ?? undefined,
              partNo: p.partNo ?? undefined,
              quantity: p.quantity ?? undefined,
              valueGbp: p.unitValueGbp ?? undefined,
              techDescription: p.technicalDescription,
              specs: p.specs.map((s) => ({
                key: s.key,
                valueRaw: s.valueRaw,
                valueNum: s.valueNum ?? undefined,
                unit: s.unit ?? undefined,
                sourcePage: s.sourcePage ?? undefined,
                sourceQuote: s.sourceQuote,
                confidence: s.confidence,
              })),
            })),
          });
        } catch (err) {
          console.warn("Failed to persist extraction to assessment:", err);
        }
      }
    }

    return NextResponse.json({
      status: audit.status,
      riskChecklist: audit.riskChecklist,
      extractedData: audit.extractedData,
    });
  } catch (error: unknown) {
    console.error("Document audit error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
