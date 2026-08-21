import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { sendEusuSubmittedEmail } from "@/lib/export-controls/end-user-email";
import { emailPathUrl } from "@/lib/export-controls/email-link-base";
import {
  endUserCredentialFromRequest,
  endUserRequestIsSameOrigin,
  expiredEndUserCookie,
} from "@/lib/export-controls/end-user-session";
import { readRequestBodyLimited } from "@/lib/export-controls/partner-signature";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notifyLimiter = new ApiRateLimiter(3, 10 * 60 * 1000);

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function expire(response: NextResponse) {
  response.cookies.set(expiredEndUserCookie());
  return response;
}

export async function POST(request: Request) {
  if (!endUserRequestIsSameOrigin(request)) {
    return json({ error: "Request not accepted" }, 403);
  }
  const credential = endUserCredentialFromRequest(request);
  if (!credential) return expire(json({ error: "Form unavailable" }, 401));
  if (!notifyLimiter.tryConsume(credential.tokenHash)) {
    return json({ error: "Request not accepted" }, 429);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "Request not accepted" }, 415);

  let rawBody: string | null;
  try {
    rawBody = await readRequestBodyLimited(request, 1_024);
  } catch {
    return json({ error: "Request not accepted" }, 400);
  }
  if (rawBody === null) return json({ error: "Request not accepted" }, 413);
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).length) {
      return json({ error: "Request not accepted" }, 400);
    }
  } catch {
    return json({ error: "Request not accepted" }, 400);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return expire(json({ error: "Request could not be completed" }, 503));

  const convex = new ConvexHttpClient(convexUrl);
  let sent = false;
  try {
    const target = await convex.query(api.compliance_end_user.getEusuNotifyTarget, credential);
    if (target) {
      const email = await sendEusuSubmittedEmail({
        to: target.notifyEmail,
        assessmentReference: target.reference,
        destinationCountry: target.destinationCountry,
        endUserName: target.endUserName,
        signedBy: target.signedBy,
        assessmentUrl: emailPathUrl("/dashboard/trade-compliance", request),
      });
      sent = email.sent;
      if (!email.sent) console.error("EUSU submitted notification was not delivered");
    }
    await convex.mutation(api.compliance_end_user.markEusuNotified, {
      ...credential,
      sent,
    });
    return expire(json({ ok: true, notified: sent }));
  } catch {
    console.error("EUSU notification request failed");
    try {
      await convex.mutation(api.compliance_end_user.markEusuNotified, {
        ...credential,
        sent: false,
      });
    } catch {
      console.error("EUSU session could not be closed after notification failure");
    }
    return expire(json({ ok: true, notified: false }));
  }
}
