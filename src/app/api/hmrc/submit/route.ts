import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { mapToCDS_H1 } from "../../../../lib/wco-mapper";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
    // We ideally would have a dedicated Convex action or query, but we can do parallel API calls for now.
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
      console.log(`[HMRC Submit] Token expired for user ${userId}, attempting refresh...`);
      if (!tokenRecord.refreshToken) {
        return NextResponse.json({ error: "HMRC Token expired and no refresh token available. Please reconnect." }, { status: 403 });
      }

      const clientId = process.env.HMRC_CLIENT_ID!;
      const clientSecret = process.env.HMRC_CLIENT_SECRET!;
      const tokenUrl = "https://test-api.service.hmrc.gov.uk/oauth/token";

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
        console.error("HMRC Token Refresh Failed:", errorText);
        return NextResponse.json({ error: "Failed to refresh HMRC token. Please reconnect.", details: errorText }, { status: 403 });
      }

      const data = await refreshResponse.json();
      token = data.access_token;

      // Update token in Convex
      await convex.mutation(api.hmrc.saveToken, {
        userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // might be a new refresh token
        expiresIn: data.expires_in || 14400,
        eori: tokenRecord.eori // Retain existing EORI
      });
      console.log(`[HMRC Submit] Successfully refreshed token for user ${userId}`);
    }

    // 2. Map the data to HMRC WCO Data Model JSON structure using our dedicated mapper
    const payloadInfo = mapToCDS_H1(lane, items);

    // Convert the JSON payload into the required HMRC XML Envelope
    // Using the exact canonical namespaces required by the HMRC Sandbox XSD
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2 ../DocumentMetaData_2_DMS.xsd ">
    <FunctionCode>${payloadInfo.Declaration.FunctionCode}</FunctionCode>
    <FunctionalReferenceID>${payloadInfo.Declaration.FunctionalReferenceID}</FunctionalReferenceID>
    <TypeCode>${payloadInfo.Declaration.TypeCode}</TypeCode>
    <Declarant>
      <ID>${payloadInfo.Declaration.Declarant.ID}</ID>
    </Declarant>
    <Exporter>
      <ID>${payloadInfo.Declaration.Exporter.ID}</ID>
    </Exporter>
    <GoodsShipment>
      ${payloadInfo.Declaration.GoodsShipment.GovernmentAgencyGoodsItem.map((item: any) => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${item.SequenceNumeric}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${item.StatisticalValueAmount.currencyID}">${item.StatisticalValueAmount.value}</StatisticalValueAmount>
        <Commodity>
          <Classification>
            <ID>${item.Commodity.Classification[0].ID}</ID>
            <IdentificationTypeCode>${item.Commodity.Classification[0].IdentificationTypeCode}</IdentificationTypeCode>
          </Classification>
        </Commodity>
        <GovernmentProcedure>
          <CurrentCode>${item.GovernmentProcedure[0].CurrentCode}</CurrentCode>
          <PreviousCode>${item.GovernmentProcedure[0].PreviousCode}</PreviousCode>
        </GovernmentProcedure>
      </GovernmentAgencyGoodsItem>`).join('')}
      <Importer>
        <ID>${payloadInfo.Declaration.GoodsShipment.Importer.ID}</ID>
      </Importer>
      <UCR>
        <TraderAssignedReferenceID>${payloadInfo.Declaration.UCR.TraderAssignedReferenceID}</TraderAssignedReferenceID>
      </UCR>
    </GoodsShipment>
  </Declaration>
</MetaData>`;

    // 3. Fire the POST request to HMRC
    // HMRC uses Accept header for versioning, not the URL path
    const hmrcEndpoint = process.env.HMRC_ENVIRONMENT === "sandbox" 
      ? "https://test-api.service.hmrc.gov.uk/customs/declarations" 
      : "https://api.service.hmrc.gov.uk/customs/declarations";

    const authHeaderString = `Bearer ${token}`;
    console.log(`[HMRC Submit] Token exact length: ${token.length}, First 15 chars: ${token.substring(0, 15)}`);
    console.log(`[HMRC Submit] Exact Auth Header: ${authHeaderString}`);

    const hmrcResponse = await fetch(hmrcEndpoint, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.hmrc.2.0+xml",
        "Content-Type": "application/xml; charset=UTF-8",
        "Authorization": authHeaderString,
        "X-Client-ID": process.env.HMRC_CLIENT_ID!
      },
      body: xmlPayload
    });

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC API Submission Error:", hmrcResponse.status, errorText);
      
      // Sandbox fallback specifically for Stripe Connect demo approval
      // Note: We are now actually testing the API, so we want the REAL validation errors to surface, 
      // not a simulated success. Let's return the actual HMRC rejection code.
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
      stack: error.stack
    }, { status: 500 });
  }
}
