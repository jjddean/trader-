import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { ResolvedHmrcContext } from "./hmrc-context";

export async function resolveHmrcAccessToken(
  convex: ConvexHttpClient,
  userId: string,
  hmrcContext: Pick<ResolvedHmrcContext, "environment">,
): Promise<{ token: string } | { error: NextResponse }> {
  try {
    const result = await convex.action(api.hmrc_actions.resolveAccessToken, {
      userId,
      environment: hmrcContext.environment,
    });
    if (!result?.token) {
      return {
        error: NextResponse.json(
          { error: "HMRC OAuth Token not found for this HMRC environment. Please connect your account." },
          { status: 403 },
        ),
      };
    }
    return { token: result.token };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to resolve HMRC token";
    if (message.includes("Forbidden") || message.includes("Unauthenticated")) {
      return {
        error: NextResponse.json({ error: message }, { status: 403 }),
      };
    }
    if (message.includes("not found") || message.includes("connect")) {
      return {
        error: NextResponse.json(
          { error: "HMRC OAuth Token not found for this HMRC environment. Please connect your account." },
          { status: 403 },
        ),
      };
    }
    console.error("[HMRC] Token resolve failed:", message);
    return {
      error: NextResponse.json(
        { error: "Failed to refresh HMRC token. Please reconnect." },
        { status: 403 },
      ),
    };
  }
}
