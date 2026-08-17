import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { emailPathUrl } from "@/lib/export-controls/email-link-base";
import { sendPortalInviteEmail } from "@/lib/portal/portal-invite-email";
import { userErrorCode } from "@/lib/convex-errors";

function publicPortalInviteError(error: unknown): string {
  switch (userErrorCode(error)) {
    case "portal_email_is_app_user":
      return "This email is already associated with a FreightCode account. Use a different portal email.";
    case "portal_email_taken":
      return "This email is already associated with another client portal. Use a different portal email.";
    default:
      return "Portal access could not be updated. Please try again.";
  }
}

export async function POST(request: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_CONVEX_URL not configured" }, { status: 500 });
    }

    if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
      return NextResponse.json(
        {
          error:
            "Invite email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL). Portal access was not enabled.",
        },
        { status: 503 },
      );
    }

    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }

    // Per-request client — shared module client races setAuth under concurrency.
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const body = (await request.json().catch(() => ({}))) as {
      clientId?: string;
      portalEmail?: string;
    };

    const clientIdRaw = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const portalEmail = typeof body.portalEmail === "string" ? body.portalEmail.trim() : "";
    if (!clientIdRaw || !portalEmail) {
      return NextResponse.json({ error: "clientId and portalEmail are required" }, { status: 400 });
    }

    const clientId = clientIdRaw as Id<"clients">;

    const access = await convex.mutation(api.clients.setPortalAccess, {
      clientId,
      portalEmail,
    });

    const client = await convex.query(api.clients.get, { clientId });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const sender = await currentUser();
    const brokerName =
      sender?.fullName?.trim() ||
      sender?.primaryEmailAddress?.emailAddress?.trim() ||
      undefined;

    const portalUrl = emailPathUrl("/portal", request);
    const signInUrl = emailPathUrl(
      `/sign-in?redirect_url=${encodeURIComponent("/portal")}`,
      request,
    );
    const signUpUrl = emailPathUrl(
      `/sign-up?redirect_url=${encodeURIComponent("/portal")}`,
      request,
    );

    const email = await sendPortalInviteEmail({
      to: access.portalEmail,
      clientName: client.name,
      brokerName,
      portalUrl,
      signInUrl,
      signUpUrl,
    });

    try {
      await convex.mutation(api.clients.recordPortalInviteSent, {
        clientId,
        portalEmail: access.portalEmail,
        emailSent: email.sent,
        emailNote: email.sent ? undefined : email.reason,
      });
    } catch {
      // Audit helper is best-effort.
    }

    if (!email.sent) {
      return NextResponse.json(
        {
          error: `Portal access was enabled, but the invite email failed${
            email.reason ? `: ${email.reason}` : "."
          }`,
          portalEmail: access.portalEmail,
          emailSent: false,
          emailNote: email.reason,
          portalUrl,
          accessEnabled: true,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      portalEmail: access.portalEmail,
      emailSent: true,
      portalUrl,
    });
  } catch (error: unknown) {
    console.error("portal invite error:", error);
    return NextResponse.json({ error: publicPortalInviteError(error) }, { status: 500 });
  }
}
