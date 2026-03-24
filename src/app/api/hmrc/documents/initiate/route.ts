import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { declarationId, fileName, fileSize } = await request.json();
    if (!declarationId || !fileName || !fileSize) {
      return NextResponse.json({ error: "Missing required document metadata" }, { status: 400 });
    }

    // Ping HMRC Secure Document Upload API to initiate an upload session
    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    
    if (!tokenRecord || !tokenRecord.accessToken) {
      return NextResponse.json({ error: "HMRC OAuth Token not found." }, { status: 403 });
    }

    // HMRC returns an S3 upload URL and a set of form AWS headers specifically for this file
    const hmrcInitiateUrl = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? "https://test-api.service.hmrc.gov.uk/logistics/documents/initiate"
      : "https://api.service.hmrc.gov.uk/logistics/documents/initiate";

    const hmrcResponse = await fetchHmrc(hmrcInitiateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "document": {
          "fileName": fileName,
          "fileSize": fileSize
        }
      })
    }, request, tokenRecord.accessToken);

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      return NextResponse.json({ error: "HMRC Sandbox SDE Initiate Failed - Missing or Invalid Credentials", details: errorText }, { status: hmrcResponse.status });
    }
    
    const parsedHMRC = await hmrcResponse.json();

    // Log intention to upload in our Convex database
    await convex.mutation(api.documents.trackUpload, {
      declarationId,
      fileName,
      fileSize,
      documentType: "trade_document", // default generic classification
      uploadStatus: "pending"
    });

    // Return the payload to the frontend so it can perform the direct S3 POST
    return NextResponse.json({ 
      success: true, 
      uploadParameters: parsedHMRC.uploadRequest || parsedHMRC
    });

  } catch (error: any) {
    console.error("Document initiate crash:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
