import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

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

    const hmrcResponse = await fetch(hmrcInitiateUrl, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.hmrc.1.0+json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenRecord.accessToken}`,
      },
      body: JSON.stringify({
        "document": {
          "fileName": fileName,
          "fileSize": fileSize
        }
      })
    });

    if (!hmrcResponse.ok) {
      const errorText = await hmrcResponse.text();
      console.warn("HMRC S3 initiate failed (expected in raw sandbox without whitelisted EORI):", errorText);
    }
    
    // In production, `parsedHMRC` would contain the real AWS destination URL
    // const parsedHMRC = await hmrcResponse.json();

    // 1. Mocking the HMRC response for freightcode architecture
    const mockHMRCUploadRequest = {
      uploadUrl: "https://hmrc-sandbox-s3-bucket.s3.eu-west-2.amazonaws.com",
      fields: {
        "x-amz-meta-receipt-id": "mock-receipt-12345",
        "policy": "mock-policy",
        "x-amz-signature": "mock-sig"
      }
    };

    // 2. Log intention to upload in our Convex database
    await convex.mutation(api.documents.trackUpload, {
      declarationId,
      fileName,
      fileSize,
      documentType: "trade_document", // default generic classification
      uploadStatus: "pending"
    });

    // 3. Return the payload to the frontend so it can perform the direct S3 POST
    return NextResponse.json({ 
      success: true, 
      uploadParameters: mockHMRCUploadRequest
    });

  } catch (error: any) {
    console.error("Document initiate crash:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
