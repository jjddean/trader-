import { NextResponse } from "next/server";

/** Plaintext consultant-token evidence URLs are permanently disabled. */
export async function GET() {
  return NextResponse.json(
    { error: "Not found" },
    {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
