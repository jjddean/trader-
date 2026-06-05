import { NextResponse } from "next/server";

/**
 * @deprecated CDS file upload no longer uses /customs/declarations/document-upload.
 * Flow: POST /api/hmrc/documents/initiate → browser S3 POST → Convex trackUpload.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use /api/hmrc/documents/initiate then track upload in Convex after S3 POST.",
    },
    { status: 410 },
  );
}
