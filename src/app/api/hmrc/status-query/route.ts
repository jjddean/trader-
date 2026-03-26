import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/hmrc/status-query?mrn={mrn}
 * Query declaration status via the Customs Declarations Information API.
 * HMRC ref: CDS End-to-End Guide > Query declaration status
 * Supports query by MRN, DUCR, or UCR.
 * Accept: application/vnd.hmrc.2.0+json (Information API uses v2.0)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mrn = searchParams.get("mrn");
    const ducr = searchParams.get("ducr");
    const ucr = searchParams.get("ucr");

    if (!mrn && !ducr && !ucr) {
      return NextResponse.json({ error: "Provide mrn, ducr, or ucr query parameter" }, { status: 400 });
    }

    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    if (!tokenRecord?.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found." }, { status: 403 });
    }

    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? "https://test-api.service.hmrc.gov.uk"
      : "https://api.service.hmrc.gov.uk";

    // Build the correct query path based on which identifier was provided
    let queryPath: string;
    if (mrn) {
      queryPath = `/customs/declarations-information/mrn/${encodeURIComponent(mrn)}/status`;
    } else if (ducr) {
      queryPath = `/customs/declarations-information/ducr/${encodeURIComponent(ducr)}/status`;
    } else {
      queryPath = `/customs/declarations-information/ucr/${encodeURIComponent(ucr!)}/status`;
    }

    const hmrcResponse = await fetchHmrc(
      `${hmrcBase}${queryPath}`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.hmrc.2.0+json",
        },
      },
      request,
      tokenRecord.accessToken
    );

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.error("HMRC Status Query Error:", hmrcResponse.status, errorText);
      return NextResponse.json(
        { error: "HMRC status query failed", details: errorText },
        { status: hmrcResponse.status }
      );
    }

    const data = await hmrcResponse.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Status query crash:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
