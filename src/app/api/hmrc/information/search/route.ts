import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import { HMRC_CONFIG } from "../../../../../lib/hmrc-config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/hmrc/information/search?partyRole={role}&declarationCategory={cat}&goodsLocationCode={code}&dateFrom={from}&dateTo={to}
 * Retrieve matching declarations in summary form.
 * HMRC ref: Customs Declarations Information API > Retrieve matching declarations
 * Accept: configured HMRC v2 JSON media type
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = new URLSearchParams();
    
    // Supported HMRC search parameters
    const supportedParams = [
      "partyRole", 
      "declarationCategory", 
      "goodsLocationCode", 
      "dateFrom", 
      "dateTo", 
      "pageNumber"
    ];

    supportedParams.forEach(param => {
      const val = searchParams.get(param);
      if (val) queryParams.append(param, val);
    });

    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    if (!tokenRecord?.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found." }, { status: 403 });
    }

    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;

    const queryUrl = `${hmrcBase}/customs/declarations-information/search?${queryParams.toString()}`;

    const hmrcResponse = await fetchHmrc(
      queryUrl,
      {
        method: "GET",
        headers: {
          Accept: HMRC_CONFIG.accept.v2Json,
        },
      },
      request,
      tokenRecord.accessToken
    );

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Search Query Error:", hmrcResponse.status, errorText);
      return NextResponse.json(
        { error: "HMRC search query failed", details: errorText },
        { status: hmrcResponse.status }
      );
    }

    const data = await hmrcResponse.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Search query crash:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
