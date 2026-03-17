import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.HMRC_CLIENT_ID;
  const redirectUri = process.env.HMRC_REDIRECT_URI;
  const scopes = process.env.HMRC_SCOPES || "write:customs-declaration";
  
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Missing HMRC environment variables" }, { status: 500 });
  }

  // Construct the HMRC Sandbox authorization URL
  const hmrcAuthUrl = new URL("https://test-api.service.hmrc.gov.uk/oauth/authorize");
  hmrcAuthUrl.searchParams.append("response_type", "code");
  hmrcAuthUrl.searchParams.append("client_id", clientId);
  hmrcAuthUrl.searchParams.append("scope", scopes);
  hmrcAuthUrl.searchParams.append("state", "dev_sandbox_state"); 
  hmrcAuthUrl.searchParams.append("redirect_uri", redirectUri);

  // Redirect the user to the Government Gateway login
  return NextResponse.redirect(hmrcAuthUrl.toString());
}
