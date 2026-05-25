import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { xmlEscape } from "../../../../lib/xml-utils";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { HMRC_CONFIG } from "../../../../lib/hmrc-config";

/**
 * POST /api/hmrc/cancel
 * Submit a cancellation (invalidation) request for an existing declaration.
 * HMRC ref: CDS End-to-End Guide > Cancel a submitted customs declaration
 * Uses Customs Declarations API with FunctionCode 13 and TypeCode INV.
 */
export async function POST(request: Request) {
  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Convex auth token missing for current Clerk session." }, { status: 401 });
    }
    convex.setAuth(convexToken);

    const { declarationId, mrn, reason } = await request.json();
    if (!declarationId || !mrn) {
      return NextResponse.json({ error: "Missing declarationId or mrn" }, { status: 400 });
    }

    const lane = await convex.query(api.declarations.getLane, { id: declarationId }) as any;
    if (!lane) {
      return NextResponse.json({ error: "Declaration not found" }, { status: 404 });
    }

    // Ownership check — must match the same gate as submit/route.ts.
    if (lane.userId !== userId && process.env.HMRC_ENVIRONMENT !== "sandbox") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    if (!tokenRecord?.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found." }, { status: 403 });
    }

    const eori = String(lane.eori || "").trim();
    if (!/^GB\d{12}$/.test(eori)) {
      return NextResponse.json({ error: "Declarant EORI on the declaration is missing or invalid (expected GB+12 digits)." }, { status: 400 });
    }
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      return NextResponse.json({ error: "Cancellation reason is required." }, { status: 400 });
    }

    // Cancellation XML — FunctionCode 13, includes MRN, reason for invalidation
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <FunctionCode>13</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(lane.lrn || `CX-${declarationId}`)}</FunctionalReferenceID>
    <ID>${xmlEscape(mrn)}</ID>
    <TypeCode>INV</TypeCode>
    <Declarant>
      <ID>${xmlEscape(eori)}</ID>
    </Declarant>
    <AdditionalInformation>
      <StatementDescription>${xmlEscape(trimmedReason)}</StatementDescription>
      <StatementTypeCode>AES</StatementTypeCode>
    </AdditionalInformation>
  </Declaration>
</MetaData>`;

    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;
    const hmrcEndpoint = `${hmrcBase}/customs/declarations`;

    const hmrcResponse = await fetchHmrc(hmrcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/xml; charset=UTF-8" },
      body: xmlPayload,
    }, request, tokenRecord.accessToken, eori);

    if (hmrcResponse.status === 429) {
      return NextResponse.json({ error: "HMRC rate limit reached" }, { status: 429 });
    }

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Cancellation Error:", hmrcResponse.status, errorText);
      return NextResponse.json({ error: "HMRC rejected cancellation", details: errorText }, { status: hmrcResponse.status });
    }

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    await convex.mutation(api.declarations.updateDeclarationStatus, {
      id: declarationId,
      status: "Cancellation Requested",
      conversationId: conversationId || undefined,
    });

    return NextResponse.json({ success: true, status: "Cancellation Requested", conversationId });
  } catch (error: any) {
    console.error("Cancellation crash:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
