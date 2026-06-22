import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";

export async function GET() {
  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Convex auth token missing" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    const bundle = await convex.query(api.account_export.exportMyData, {});

    try {
      await convex.mutation(api.audit.logMyAction, {
        action: "data_export",
        metadata: {
          scope: bundle.export.scope,
          counts: bundle.counts,
        },
      });
    } catch {
      // Audit failure must not block export.
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `freightcode-data-export-${date}.json`;

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Account export failed:", error);
    return NextResponse.json({ error: "Failed to export account data" }, { status: 500 });
  }
}
