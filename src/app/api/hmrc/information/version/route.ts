import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import { HMRC_CONFIG } from "../../../../../lib/hmrc-config";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";

/**
 * GET /api/hmrc/information/version?mrn={mrn}
 * Retrieve the latest versions of a declaration by MRN.
 * HMRC ref: Customs Declarations Information API > Retrieve the latest versions of a declaration
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
    const mrn = searchParams.get("mrn");

    if (!mrn) {
      return NextResponse.json({ error: "Missing mrn query parameter" }, { status: 400 });
    }

    const tokenResult = await resolveHmrcAccessToken(convex, userId);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    const hmrcBase =
      process.env.HMRC_ENVIRONMENT === "sandbox"
        ? HMRC_CONFIG.sandboxBaseUrl
        : HMRC_CONFIG.productionBaseUrl;

    const queryUrl = `${hmrcBase}/customs/declarations-information/mrn/${encodeURIComponent(mrn)}/version`;

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
    );

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Version Query Error:", hmrcResponse.status, errorText);
      return NextResponse.json(
        { error: "HMRC version query failed", details: errorText },
        { status: hmrcResponse.status },
      );
    }

    const data = await hmrcResponse.json();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("Version query crash:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: "Internal Server Error", message }, { status: 500 });
  }
}
