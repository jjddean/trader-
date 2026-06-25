import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check endpoint for monitoring. Reports HMRC environment and which
 * core service env vars are populated (Convex, HMRC, Clerk).
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.HMRC_ENVIRONMENT || "unknown",
    services: {
      convex: !!process.env.NEXT_PUBLIC_CONVEX_URL,
      hmrc: !!process.env.HMRC_CLIENT_ID,
      clerk: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
    livePlatform: {
      productionHmrcOAuth: Boolean(
        process.env.HMRC_PRODUCTION_CLIENT_ID?.trim() &&
          process.env.HMRC_PRODUCTION_CLIENT_SECRET?.trim(),
      ),
      hmrcEnvironment: process.env.HMRC_ENVIRONMENT || "unknown",
    },
  });
}
