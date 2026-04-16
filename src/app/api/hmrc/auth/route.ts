import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const clientId = process.env.HMRC_CLIENT_ID;
  const redirectUri = process.env.HMRC_REDIRECT_URI;
  const scopes = process.env.HMRC_SCOPES || "write:customs-declaration write:customs-declarations-information";
  const hmrcAuthBase = process.env.HMRC_ENVIRONMENT === "sandbox"
    ? "https://test-api.service.hmrc.gov.uk/oauth/authorize"
    : "https://api.service.hmrc.gov.uk/oauth/authorize";

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Missing HMRC environment variables" }, { status: 500 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const state = `${crypto.randomUUID()}.${userId}`;

  const hmrcAuthUrl = new URL(hmrcAuthBase);
  hmrcAuthUrl.searchParams.append("response_type", "code");
  hmrcAuthUrl.searchParams.append("client_id", clientId);
  hmrcAuthUrl.searchParams.append("scope", scopes);
  hmrcAuthUrl.searchParams.append("state", state);
  hmrcAuthUrl.searchParams.append("redirect_uri", redirectUri);

  console.log("[HMRC AUTH] client_id:", clientId);
  console.log("[HMRC AUTH] redirect_uri:", redirectUri);
  console.log("[HMRC AUTH] scope:", scopes);
  console.log("[HMRC AUTH] full url:", hmrcAuthUrl.toString());

  return NextResponse.redirect(hmrcAuthUrl.toString());
}
