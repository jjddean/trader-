import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("HMRC Auth Error:", error, errorDescription);
    return NextResponse.redirect(new URL(`/dashboard?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      console.error("No authenticated Clerk user found during HMRC callback");
      return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
    }

    const clientId = process.env.HMRC_CLIENT_ID!;
    const clientSecret = process.env.HMRC_CLIENT_SECRET!;
    const redirectUri = process.env.HMRC_REDIRECT_URI!;

    const tokenUrl = "https://test-api.service.hmrc.gov.uk/oauth/token";
    console.log("EXCHANGING TOKEN WITH REDIRECT URI:", redirectUri);
    
    const body = new URLSearchParams({
      client_secret: clientSecret,
      client_id: clientId,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Failed to exchange token with HMRC:", errText);
      return NextResponse.redirect(new URL("/dashboard?error=token_exchange_failed", request.url));
    }

    const data = await response.json();
    
    // Save tokens to Convex and link to workspace
    await convex.mutation(api.hmrc.saveToken, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 14400, // typically 4 hours for Sandbox
    });

    return NextResponse.redirect(new URL("/dashboard?success=hmrc_connected", request.url));

  } catch (err) {
    console.error("Exception in HMRC callback:", err);
    return NextResponse.redirect(new URL("/dashboard?error=internal_error", request.url));
  }
}
