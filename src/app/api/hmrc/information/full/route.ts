import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import { HMRC_CONFIG } from "../../../../../lib/hmrc-config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/hmrc/information/full?mrn={mrn}
 * Retrieve the full declaration by MRN.
 * HMRC ref: Customs Declarations Information API > Retrieve the full declaration
 * Accept: configured HMRC v2 JSON media type
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mrn = searchParams.get("mrn");

    if (!mrn) {
      return NextResponse.json({ error: "Missing mrn query parameter" }, { status: 400 });
    }

    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    if (!tokenRecord?.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found." }, { status: 403 });
    }

    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;

    const queryUrl = `${hmrcBase}/customs/declarations-information/mrn/${encodeURIComponent(mrn)}/full`;

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
      console.error("HMRC Full Query Error:", hmrcResponse.status, errorText);
      return NextResponse.json(
        { error: "HMRC full query failed", details: errorText },
        { status: hmrcResponse.status }
      );
    }

    const data = await hmrcResponse.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Full query crash:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
