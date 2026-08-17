import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { sendConsultantReviewEmail } from "@/lib/export-controls/consultant-email";
import { emailPathUrl } from "@/lib/export-controls/email-link-base";
import { userMessageFromError } from "@/lib/convex-errors";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function reviewUrl(token: string, request: Request): string {
  return emailPathUrl(`/r/export/${token}`, request);
}

export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }
    convex.setAuth(convexToken);

    const body = await request.json();
    const assessmentId = body.assessmentId as Id<"export_assessments"> | undefined;
    if (!assessmentId) {
      return NextResponse.json({ error: "assessmentId required" }, { status: 400 });
    }

    const consultantEmail =
      typeof body.consultantEmail === "string" ? body.consultantEmail.trim() : "";
    if (!consultantEmail) {
      return NextResponse.json({ error: "consultantEmail required" }, { status: 400 });
    }

    const dispatch = await convex.mutation(api.compliance_consultant.createConsultantDispatch, {
      assessmentId,
      consultantEmail,
      senderNote: typeof body.senderNote === "string" ? body.senderNote : undefined,
      consultantName: typeof body.consultantName === "string" ? body.consultantName : undefined,
    });

    const assessment = await convex.query(api.export_controls.getAssessment, { assessmentId });
    const url = reviewUrl(dispatch.token, request);
    const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;

    const email = await sendConsultantReviewEmail({
      to: dispatch.consultantEmail,
      consultantName: dispatch.consultantName,
      assessmentReference: assessment?.assessment.reference ?? assessmentId,
      destinationCountry: assessment?.assessment.destinationCountry,
      status: assessment?.assessment.status ?? "review_required",
      senderNote: typeof body.senderNote === "string" ? body.senderNote : undefined,
      reviewUrl: url,
      expiresAt,
    });

    return NextResponse.json({
      ok: true,
      reviewUrl: url,
      consultantEmail: dispatch.consultantEmail,
      emailSent: email.sent,
      emailNote: email.sent ? undefined : email.reason,
    });
  } catch (error: unknown) {
    console.error("send-to-consultant error:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
