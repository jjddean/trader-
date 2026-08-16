import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { sendEusuSubmittedEmail } from "@/lib/export-controls/end-user-email";
import { emailPathUrl } from "@/lib/export-controls/email-link-base";
import { userMessageFromError } from "@/lib/convex-errors";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Called by the end-user form after a successful submit. Unauthenticated by design —
 * the one-time token gates it, and the notify target is resolved server-side so the
 * caller cannot choose a recipient.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const target = await convex.query(api.compliance_end_user.getEusuNotifyTarget, { token });
    if (!target) {
      // Already notified, incomplete, or no notify address on file — nothing to do.
      return NextResponse.json({ ok: true, notified: false });
    }

    const email = await sendEusuSubmittedEmail({
      to: target.notifyEmail,
      assessmentReference: target.reference,
      destinationCountry: target.destinationCountry,
      endUserName: target.endUserName,
      signedBy: target.signedBy,
      assessmentUrl: emailPathUrl("/dashboard/trade-compliance", request),
    });

    if (email.sent) {
      await convex.mutation(api.compliance_end_user.markEusuNotified, { token });
    }

    return NextResponse.json({
      ok: true,
      notified: email.sent,
      note: email.sent ? undefined : email.reason,
    });
  } catch (error: unknown) {
    console.error("eusu-submitted notify error:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
