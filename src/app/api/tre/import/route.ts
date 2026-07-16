import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import {
  parseTreCsv,
  parseTreCsvRows,
  TRE_IMPORT_MAX_BYTES,
  TRE_IMPORT_MAX_ROWS,
} from "@/lib/tre-csv-parser";

function rowToCommitPayload(row: ReturnType<typeof parseTreCsvRows>[number]) {
  return {
    reportKind: row.reportKind,
    entryIdentifierMrn: row.entryIdentifierMrn,
    sourceRowHash: row.sourceRowHash,
    sourceLineNumber: row.sourceLineNumber,
    itemNumber: row.itemNumber,
    declarantEori: row.declarantEori,
    importerEori: row.importerEori,
    commodityCode: row.commodityCode,
    countryOfOriginCode: row.countryOfOriginCode,
    countryOfDispatchCode: row.countryOfDispatchCode,
    destinationCountryCode: row.destinationCountryCode,
    preferenceCode: row.preferenceCode,
    itemCustomsValue: row.itemCustomsValue,
    taxLineTotalAmount: row.taxLineTotalAmount,
    methodOfPaymentCode: row.methodOfPaymentCode,
    customsProcedureCodeCpc: row.customsProcedureCodeCpc,
    taxType: row.taxType,
    dutyRatePercent: row.dutyRatePercent,
    acceptanceDate: row.acceptanceDate,
    goodsDescription: row.goodsDescription,
    netMassKg: row.netMassKg,
    documentCodes: row.documentCodes,
    invoiceTotalGbp: row.invoiceTotalGbp,
    transportCostGbp: row.transportCostGbp,
    totalDutyGbp: row.totalDutyGbp,
    totalVatGbp: row.totalVatGbp,
    goodsDepartureDate: row.goodsDepartureDate,
  };
}

export async function POST(request: Request) {
  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Convex auth token missing" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") || "preview");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Upload a .csv file exported from HMRC TRE" }, { status: 400 });
    }

    if (file.size > TRE_IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
    }

    const text = await file.text();
    const preview = parseTreCsv(text);

    if (mode === "preview") {
      return NextResponse.json({ preview });
    }

    if (mode !== "commit") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (preview.format === "unknown") {
      return NextResponse.json(
        {
          error:
            "Unrecognised CSV format. Use an HMRC TRE report (Import Item, Import Header, Import Tax Lines, or Export Item).",
        },
        { status: 400 },
      );
    }

    if (preview.rowCount === 0) {
      return NextResponse.json({ error: "No importable rows found" }, { status: 400 });
    }

    const rows = parseTreCsvRows(text, TRE_IMPORT_MAX_ROWS);

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    const result = await convex.mutation(api.tre_imports.commitImport, {
      filename: file.name,
      reportFormat: preview.format,
      checksum: preview.checksum,
      rowCount: preview.rowCount,
      warnings: preview.warnings.map((w) => w.message),
      rows: rows.map(rowToCommitPayload),
    });

    return NextResponse.json({ preview, result });
  } catch (error) {
    console.error("TRE import failed:", error);
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
