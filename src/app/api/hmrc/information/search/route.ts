import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import { HMRC_CONFIG } from "../../../../../lib/hmrc-config";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForOrg } from "../../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";
import { userMessageFromError } from "@/lib/convex-errors";

/**
 * GET /api/hmrc/information/search?partyRole={role}&declarationCategory={cat}&goodsLocationCode={code}&dateFrom={from}&dateTo={to}
 * Retrieve matching declarations in summary form.
 * HMRC ref: Customs Declarations Information API > Retrieve matching declarations
 * Accept: configured HMRC v2 JSON media type
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
    const queryParams = new URLSearchParams();

    const supportedParams = [
      "partyRole",
      "declarationCategory",
      "goodsLocationCode",
      "dateFrom",
      "dateTo",
      "pageNumber",
    ];

    supportedParams.forEach((param) => {
      const val = searchParams.get(param);
      if (val) queryParams.append(param, val);
    });

    const orgRouting = await resolveOrgHmrcRoutingForOrg(convex, clerkAuth.orgId);
    if ("error" in orgRouting) {
      return orgRouting.error;
    }
    const { hmrcContext } = orgRouting;

    const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    const queryUrl = `${hmrcContext.apiBaseUrl}/customs/declarations-information/search?${queryParams.toString()}`;

    const hmrcResponse = await fetchHmrc(
      queryUrl,
      {
        method: "GET",
        headers: {
          Accept: HMRC_CONFIG.accept.v2Json,
        },
      },
      request,
      tokenResult.token,
      undefined,
      hmrcContext,
    );

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Search Query Error:", hmrcResponse.status, errorText);
      return NextResponse.json(
        { error: "HMRC search query failed", details: errorText },
        { status: hmrcResponse.status },
      );
    }

    const data = await hmrcResponse.json();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("Search query crash:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
