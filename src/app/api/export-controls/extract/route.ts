import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { AI_MAX_UPLOAD_BYTES, aiExtractLimiter } from "@/lib/api-rate-limiter";
import { extractTextWithTextract } from "@/lib/textract";
import {
  EXPORT_EXTRACTION_PROMPT_VERSION,
  extractExportFactsFromText,
} from "@/lib/export-controls/extraction";
import { userMessageFromError } from "@/lib/convex-errors";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const assessmentIdRaw = formData.get("assessmentId") as string | null;
    const persist = formData.get("persist") === "true";
    const documentIdRaw = formData.get("documentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No document file uploaded" }, { status: 400 });
    }
    if (file.size > AI_MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }
    if (persist && !assessmentIdRaw) {
      return NextResponse.json({ error: "assessmentId required when persist=true" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rawText = "";
    try {
      rawText = await extractTextWithTextract(buffer);
    } catch (parseError: unknown) {
      const message = userMessageFromError(parseError, "parse failed");
      return NextResponse.json(
        {
          error: "Failed to parse document via Textract. Use a clear PNG/JPEG or a single-page PDF.",
          details: message,
        },
        { status: 400 },
      );
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: "No readable text found in the document" }, { status: 400 });
    }

    const extraction = await extractExportFactsFromText(rawText);

    let persisted: { productIds: string[] } | null = null;
    if (persist && assessmentIdRaw) {
      const convexToken = await getToken({ template: "convex" });
      if (!convexToken) {
        return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
      }
      convex.setAuth(convexToken);

      persisted = await convex.mutation(api.export_controls.persistExtraction, {
        assessmentId: assessmentIdRaw as Id<"export_assessments">,
        destinationCountry: extraction.shipment.destinationCountry ?? undefined,
        consignee: extraction.shipment.consignee,
        endUser: extraction.shipment.endUser,
        intendedUse: extraction.shipment.intendedUse ?? undefined,
        promptVersion: EXPORT_EXTRACTION_PROMPT_VERSION,
        sourceDocumentId: documentIdRaw ? (documentIdRaw as Id<"documents">) : undefined,
        products: extraction.products.map((p) => ({
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
    }

    return NextResponse.json({
      rawText,
      extraction,
      promptVersion: EXPORT_EXTRACTION_PROMPT_VERSION,
      persisted,
    });
  } catch (error: unknown) {
    console.error("Export controls extract error:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
