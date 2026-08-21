import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { consultantReviewCredentialFromRequest } from "@/lib/export-controls/consultant-review-session";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const evidenceLimiter = new ApiRateLimiter(120, 10 * 60_000);

function notFound() {
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

export async function GET(
  request: Request,
  context: { params: Promise<{ evidenceId: string }> },
) {
  const credential = consultantReviewCredentialFromRequest(request);
  if (!credential) return notFound();
  if (!evidenceLimiter.tryConsume(credential.tokenHash)) return notFound();

  const { evidenceId } = await context.params;
  if (!/^[a-z0-9]{20,64}$/i.test(evidenceId)) return notFound();

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const file = await convex.mutation(api.compliance_consultant.getReviewEvidenceByToken, {
      ...credential,
      evidenceId: evidenceId as Id<"export_evidence">,
    });
    if (!file) return notFound();

    const upstream = await fetch(file.url, {
      signal: AbortSignal.timeout(30_000),
      redirect: "manual",
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Could not read the file" },
        { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const fileName = file.fileName.replace(/["\r\n\\/]/g, "_").slice(0, 180) || "evidence";
    const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(file.contentType)
      ? file.contentType
      : "application/octet-stream";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": "sandbox",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
