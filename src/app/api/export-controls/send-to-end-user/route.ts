import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { sendEndUserStatementEmail } from "@/lib/export-controls/end-user-email";
import { emailPathUrl } from "@/lib/export-controls/email-link-base";
import { userMessageFromError } from "@/lib/convex-errors";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function formUrl(token: string, request: Request): string {
  return emailPathUrl(`/r/end-user/${token}`, request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reviewToken = typeof body.reviewToken === "string" ? body.reviewToken.trim() : "";
    const assessmentId = body.assessmentId as Id<"export_assessments"> | undefined;
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
    const senderNote = typeof body.senderNote === "string" ? body.senderNote : undefined;

    if (!recipientEmail) {
      return NextResponse.json({ error: "recipientEmail required" }, { status: 400 });
    }
    if (!reviewToken && !assessmentId) {
      return NextResponse.json({ error: "assessmentId or reviewToken required" }, { status: 400 });
    }

    let dispatch: { token: string; recipientEmail: string; expiresAt: number };

    if (assessmentId) {
      const { userId, getToken } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
      }
      const convexToken = await getToken({ template: "convex" });
      if (!convexToken) {
        return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
      }
      convex.setAuth(convexToken);

      const sender = await currentUser();
      const notifyEmail = sender?.primaryEmailAddress?.emailAddress?.trim();

      dispatch = await convex.mutation(api.compliance_end_user.createEndUserDispatchFromAssessment, {
        assessmentId,
        recipientEmail,
        notifyEmail: notifyEmail || undefined,
        senderNote,
      });
    } else {
      dispatch = await convex.mutation(api.compliance_end_user.createEndUserDispatch, {
        reviewToken,
        recipientEmail,
        senderNote,
      });
    }

    const form = await convex.query(api.compliance_end_user.getEndUserFormByToken, {
      token: dispatch.token,
    });

    const url = formUrl(dispatch.token, request);
    const productSummary =
      form?.products.map((p) => p.name).slice(0, 3).join(", ") +
      (form && form.products.length > 3 ? "…" : "");

    const email = await sendEndUserStatementEmail({
      to: dispatch.recipientEmail,
      assessmentReference: form?.assessment.reference ?? "export assessment",
      destinationCountry: form?.assessment.destinationCountry,
      productSummary: productSummary || undefined,
      senderNote,
      formUrl: url,
      expiresAt: dispatch.expiresAt,
    });

    return NextResponse.json({
      ok: true,
      formUrl: url,
      recipientEmail: dispatch.recipientEmail,
      emailSent: email.sent,
      emailNote: email.sent ? undefined : email.reason,
    });
  } catch (error: unknown) {
    console.error("send-to-end-user error:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
