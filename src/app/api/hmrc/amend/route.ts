import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { xmlEscape } from "../../../../lib/xml-utils";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/hmrc/amend
 * Submit an amendment to an existing declaration.
 * HMRC ref: CDS End-to-End Guide > Amend a submitted customs declaration
 * Uses same Customs Declarations API but with FunctionCode 13 and the MRN.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { declarationId, mrn } = await request.json();
    if (!declarationId || !mrn) {
      return NextResponse.json({ error: "Missing declarationId or mrn" }, { status: 400 });
    }

    // Fetch declaration and token
    const lane = await convex.query(api.declarations.getLane, { id: declarationId }) as any;
    if (!lane) {
      return NextResponse.json({ error: "Declaration not found" }, { status: 404 });
    }

    const items = await convex.query(api.goods_items.getItems, { declarationId });
    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });

    if (!tokenRecord?.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found. Please connect your account." }, { status: 403 });
    }

    const token = tokenRecord.accessToken;

    // Build amendment XML — FunctionCode 13 = amendment, includes MRN as ID
    const totalGrossWeight = items.reduce((acc: number, item: any) => acc + (parseFloat(item.grossWeightKg) || 0), 0) || 100;
    const invoiceTotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.valueAmount) || 0), 0) || 1000;
    const eori = lane?.eori || "";

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(lane.lrn || `AM-${declarationId}`)}</FunctionalReferenceID>
    <ID>${xmlEscape(mrn)}</ID>
    <TypeCode>${xmlEscape(lane.declarationType === "export" ? "EXA" : "IMA")}</TypeCode>
    <GoodsItemQuantity>${items.length || 1}</GoodsItemQuantity>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(lane.totalGrossWeight || totalGrossWeight)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${items.reduce((acc: number, item: any) => acc + (parseInt(item.packageCount) || 1), 0)}</TotalPackageQuantity>
    <InvoiceAmount currencyID="${xmlEscape(lane.invoiceCurrency || "GBP")}">${xmlEscape(lane.invoiceTotal || invoiceTotal)}</InvoiceAmount>
    <Declarant>
      <ID>${xmlEscape(eori)}</ID>
    </Declarant>
    <GoodsShipment>
      ${items.map((item: any, idx: number) => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${idx + 1}</SequenceNumeric>
        <Commodity>
          <Description>${xmlEscape(item.description || "")}</Description>
          <Classification>
            <ID>${xmlEscape(item.commodityCode || item.hsCode || "")}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
        </Commodity>
      </GovernmentAgencyGoodsItem>`).join("")}
    </GoodsShipment>
  </Declaration>
</MetaData>`;

    // Submit to HMRC
    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? "https://test-api.service.hmrc.gov.uk"
      : "https://api.service.hmrc.gov.uk";
    const hmrcEndpoint = `${hmrcBase}/customs/declarations`;

    const hmrcResponse = await fetchHmrc(hmrcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/xml; charset=UTF-8" },
      body: xmlPayload,
    }, request, token);

    if (hmrcResponse.status === 429) {
      return NextResponse.json({ error: "HMRC rate limit reached" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Amendment Error:", hmrcResponse.status, errorText);
      return NextResponse.json({ error: "HMRC rejected amendment", details: errorText }, { status: hmrcResponse.status });
    }

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    await convex.mutation(api.declarations.updateDeclarationStatus, {
      id: declarationId,
      status: "Amendment Processing",
      conversationId: conversationId || undefined,
    });

    return NextResponse.json({ success: true, status: "Amendment Processing", conversationId });
  } catch (error: any) {
    console.error("Amendment crash:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
