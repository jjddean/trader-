import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import type { auth } from "@clerk/nextjs/server";

type ClerkAuth = Awaited<ReturnType<typeof auth>>;

export type HmrcRouteSession =
  | { error: NextResponse }
  | { convex: ConvexHttpClient; userId: string };

export async function getAuthenticatedConvex(clerkAuth: ClerkAuth): Promise<HmrcRouteSession> {
  const { userId } = clerkAuth;
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const convexToken = await clerkAuth.getToken({ template: "convex" });
  if (!convexToken) {
    return {
      error: NextResponse.json(
        {
          error:
            "Convex auth token missing for current Clerk session. Please re-authenticate.",
        },
        { status: 401 },
      ),
    };
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(convexToken);
  return { convex, userId };
}
