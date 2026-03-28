import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { mapToCDS_H1, validateCdsFields } from "../../../../lib/wco-mapper";
import { xmlEscape } from "../../../../lib/xml-utils";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    let { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { declarationId } = await request.json();
    if (!declarationId) {
      return NextResponse.json({ error: "Missing declarationId" }, { status: 400 });
    }

    // 1. Fetch the Declaration, Items, and Auth Token from Convex
    const lane = await convex.query(api.declarations.getLane, { id: declarationId });
    if (!lane || (lane.userId !== userId && process.env.HMRC_ENVIRONMENT !== "sandbox")) {
      return NextResponse.json({ error: "Declaration not found or unauthorized" }, { status: 404 });
    }
    
    const items = await convex.query(api.goods_items.getItems, { declarationId });
    
    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    
    if (!tokenRecord || !tokenRecord.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found. Please connect your account." }, { status: 403 });
    }

    let token = tokenRecord.accessToken;

    // Check if token is expired or expiring within 5 minutes (300000 ms)
    if (tokenRecord.expiresAt && Date.now() + 300000 > tokenRecord.expiresAt) {
      if (!tokenRecord.refreshToken) {
        return NextResponse.json({ error: "HMRC Token expired and no refresh token available. Please reconnect." }, { status: 403 });
      }

      const clientId = process.env.HMRC_CLIENT_ID!;
      const clientSecret = process.env.HMRC_CLIENT_SECRET!;
      const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
        ? "https://test-api.service.hmrc.gov.uk"
        : "https://api.service.hmrc.gov.uk";
      const tokenUrl = `${hmrcBase}/oauth/token`;

      const refreshBody = new URLSearchParams({
        client_secret: clientSecret,
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: tokenRecord.refreshToken,
      });

      const refreshResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: refreshBody.toString(),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        return NextResponse.json({ error: "Failed to refresh HMRC token. Please reconnect.", details: errorText }, { status: 403 });
      }

      const data = await refreshResponse.json();
      token = data.access_token;

      // Update token in Convex
      await convex.mutation(api.hmrc.saveToken, {
        userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 14400,
        eori: tokenRecord.eori
      });
    }

    const payloadInfo = mapToCDS_H1(lane, items);
    const validationErrors = validateCdsFields(lane, items, payloadInfo);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          fields: validationErrors,
        },
        { status: 400 },
      );
    }

    // Convert the JSON payload into the required HMRC XML Envelope
    const d = payloadInfo.Declaration;
    const gs = d.GoodsShipment;
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2 ../DocumentMetaData_2_DMS.xsd ">
    <FunctionCode>${xmlEscape(d.FunctionCode)}</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(d.FunctionalReferenceID)}</FunctionalReferenceID>
    <TypeCode>${xmlEscape(d.TypeCode)}</TypeCode>
    <GoodsItemQuantity>${xmlEscape(d.GoodsItemQuantity)}</GoodsItemQuantity>
    <DeclarationOfficeID>${xmlEscape(d.DeclarationOfficeID)}</DeclarationOfficeID>
    <InvoiceAmount currencyID="${xmlEscape(d.InvoiceAmount.currencyID)}">${xmlEscape(d.InvoiceAmount.value)}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(d.TotalGrossMassMeasure)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>
    <CurrencyExchange>
      <CurrencyTypeCode>${xmlEscape(d.CurrencyExchange.CurrencyTypeCode)}</CurrencyTypeCode>
    </CurrencyExchange>
    <Declarant>
      <ID>${xmlEscape(d.Declarant.ID)}</ID>
    </Declarant>
    <Exporter>
      <ID>${xmlEscape(d.Exporter.ID)}</ID>
    </Exporter>
    <GoodsShipment>
      <Consignment>
        <ContainerCode>${xmlEscape(gs.Consignment.ContainerCode)}</ContainerCode>
        <ArrivalTransportMeans>
          <ID>${xmlEscape(gs.Consignment.BorderTransportMeans.ID)}</ID>
          <IdentificationTypeCode>${xmlEscape(gs.Consignment.BorderTransportMeans.IdentificationTypeCode)}</IdentificationTypeCode>
          <ModeCode>${xmlEscape(gs.Consignment.BorderTransportMeans.ModeCode)}</ModeCode>
        </ArrivalTransportMeans>
        <GoodsLocation>
          <Name>${xmlEscape(gs.Consignment.GoodsLocation.Name)}</Name>
          <ID>${xmlEscape(gs.Consignment.GoodsLocation.ID)}</ID>
        </GoodsLocation>
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(gs.Destination.CountryCode)}</CountryCode>
      </Destination>
      <ExportCountry>
        <ID>${xmlEscape(gs.ExportCountry.ID)}</ID>
      </ExportCountry>
      ${gs.GovernmentAgencyGoodsItem.map((item: any) => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(item.SequenceNumeric)}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${xmlEscape(item.StatisticalValueAmount.currencyID)}">${xmlEscape(item.StatisticalValueAmount.value)}</StatisticalValueAmount>
        <AdditionalDocument>
          <CategoryCode>${xmlEscape(item.AdditionalDocument[0].CategoryCode)}</CategoryCode>
          <ID>${xmlEscape(item.AdditionalDocument[0].ID)}</ID>
          <TypeCode>${xmlEscape(item.AdditionalDocument[0].TypeCode)}</TypeCode>
        </AdditionalDocument>
        <Commodity>
          <Description>${xmlEscape(item.Commodity.Description)}</Description>
          <Classification>
            <ID>${xmlEscape(item.Commodity.Classification[0].ID)}</ID>
            <IdentificationTypeCode>${xmlEscape(item.Commodity.Classification[0].IdentificationTypeCode)}</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.GrossMassMeasure)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.NetNetWeightMeasure)}</NetNetWeightMeasure>
          </GoodsMeasure>
        </Commodity>
        ${item.GovernmentProcedure.map((proc: any) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(proc.CurrentCode)}</CurrentCode>
          ${proc.PreviousCode ? `<PreviousCode>${xmlEscape(proc.PreviousCode)}</PreviousCode>` : ''}
        </GovernmentProcedure>`).join('')}
        <Packaging>
          <SequenceNumeric>${xmlEscape(item.Packaging[0].SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(item.Packaging[0].MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(item.Packaging[0].QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(item.Packaging[0].TypeCode)}</TypeCode>
        </Packaging>
      </GovernmentAgencyGoodsItem>`).join('')}
      <Importer>
        <ID>${xmlEscape(gs.Importer.ID)}</ID>
      </Importer>
      <TradeTerms>
        <ConditionCode>${xmlEscape(gs.TradeTerms.ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(gs.TradeTerms.LocationID)}</LocationID>
      </TradeTerms>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(d.UCR.TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
    </GoodsShipment>
  </Declaration>
</MetaData>`;

    // 3. Fire the POST request to HMRC
    const hmrcEndpoint = process.env.HMRC_ENVIRONMENT === "sandbox" 
      ? "https://test-api.service.hmrc.gov.uk/customs/declarations" 
      : "https://api.service.hmrc.gov.uk/customs/declarations";

    const hmrcHeaders = {
      "Content-Type": "application/xml; charset=UTF-8",
    };

    let hmrcResponse = await fetchHmrc(hmrcEndpoint, {
      method: "POST",
      headers: hmrcHeaders,
      body: xmlPayload,
    }, request, token);

    if (hmrcResponse.status === 429) {
      return NextResponse.json({ error: "HMRC rate limit reached, please try again shortly" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC API Submission Error:", hmrcResponse.status, errorText);
      return NextResponse.json({ error: "HMRC Sandbox Rejected Payload", details: errorText }, { status: hmrcResponse.status });
    }

    // 4. Handle Synchronous Accepted Response (202)
    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    
    // Update declaration status to Processing
    await convex.mutation(api.declarations.updateDeclarationStatus, {
      id: declarationId,
      status: "Processing",
      conversationId: conversationId || undefined
    });

    // 5. Audit Log Entry (non-critical, don't crash submission on failure)
    try {
      await convex.mutation(api.audit.logAction, {
        userId,
        action: "declaration_submitted",
        metadata: {
          declarationId: declarationId as any,
          mrn: lane.mrn || "Draft",
          environment: process.env.HMRC_ENVIRONMENT || "sandbox",
          conversationId: conversationId || undefined
        }
      });
    } catch (auditErr) {
      console.warn("[AUDIT] Failed to log submission (non-critical):", auditErr);
    }

    return NextResponse.json({ 
      success: true, 
      status: "Processing",
      conversationId 
    });

  } catch (error: any) {
    console.error("Submission crash:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: error.message,
    }, { status: 500 });
  }
}
