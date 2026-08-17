import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForOrg } from "../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../lib/hmrc-token";
import { parseDeclarationStatusXml } from "../../../../lib/hmrc-information";
import { userMessageFromError } from "@/lib/convex-errors";

/**
 * GET /api/hmrc/status-query?mrn={mrn}
 * Query declaration status via the Customs Declarations Information API.
 * HMRC ref: CDS End-to-End Guide > Query declaration status
 * Supports query by MRN, DUCR, or UCR.
 * Trade Test: Accept application/vnd.hmrc.1.0+xml
 */
export async function GET(request: Request) {
  try {
    const clerkAuth = await auth();
    const session = await getAuthenticatedConvex(clerkAuth);
    if ("error" in session) {
      return session.error;
    }
    const { convex, userId } = session;

    const { searchParams } = new URL(request.url);
    const mrn = searchParams.get("mrn");
    const ducr = searchParams.get("ducr");
    const ucr = searchParams.get("ucr");

    if (!mrn && !ducr && !ucr) {
      return NextResponse.json({ error: "Provide mrn, ducr, or ucr query parameter" }, { status: 400 });
    }

    const orgRouting = await resolveOrgHmrcRoutingForOrg(convex, clerkAuth.orgId);
    if ("error" in orgRouting) {
      return orgRouting.error;
    }
    const { hmrcContext } = orgRouting;

    const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }
    const accept = hmrcContext.informationAccept;

    let queryPath: string;
    if (mrn) {
      queryPath = `/customs/declarations-information/mrn/${encodeURIComponent(mrn)}/status`;
    } else if (ducr) {
      queryPath = `/customs/declarations-information/ducr/${encodeURIComponent(ducr)}/status`;
    } else {
      queryPath = `/customs/declarations-information/ucr/${encodeURIComponent(ucr!)}/status`;
    }

    const hmrcResponse = await fetchHmrc(
      `${hmrcContext.apiBaseUrl}${queryPath}`,
      {
        method: "GET",
        headers: {
          Accept: accept,
        },
      },
      request,
      tokenResult.token,
      undefined,
      hmrcContext,
    );

    const bodyText = await hmrcResponse.text();

    if (!hmrcResponse.ok) {
      console.error("HMRC Status Query Error:", hmrcResponse.status, bodyText);
      return NextResponse.json(
        { error: "HMRC status query failed", details: bodyText },
        { status: hmrcResponse.status },
      );
    }

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");

    if (accept.includes("+json")) {
      const data = JSON.parse(bodyText);
      return NextResponse.json({ success: true, data, conversationId });
    }

    const parsed = parseDeclarationStatusXml(bodyText);
    return NextResponse.json({
      success: true,
      conversationId,
      data: {
        status: parsed.ics ? `ICS ${parsed.ics}` : "unknown",
        mrn: parsed.mrn,
        ics: parsed.ics,
        roe: parsed.roe,
        versionId: parsed.versionId,
        typeCode: parsed.typeCode,
        rawXml: bodyText,
        parsed,
      },
    });
  } catch (error: unknown) {
    console.error("Status query crash:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
