import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { sendEndUserStatementEmail } from "@/lib/export-controls/end-user-email";
import { emailPathUrl } from "@/lib/export-controls/email-link-base";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function formUrl(token: string, request: Request): string {
  return emailPathUrl(`/r/end-user/${token}`, request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reviewToken = typeof body.reviewToken === "string" ? body.reviewToken.trim() : "";
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";

    if (!reviewToken || !recipientEmail) {
      return NextResponse.json({ error: "reviewToken and recipientEmail required" }, { status: 400 });
    }

    const dispatch = await convex.mutation(api.compliance_end_user.createEndUserDispatch, {
      reviewToken,
      recipientEmail,
      senderNote: typeof body.senderNote === "string" ? body.senderNote : undefined,
    });

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
      senderNote: typeof body.senderNote === "string" ? body.senderNote : undefined,
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
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
