import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check endpoint for monitoring.
 * HMRC TDR Readiness Pillar 4: Go Live & Support
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
  });
}
