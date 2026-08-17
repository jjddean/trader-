import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function secretsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorizeBearer(request: Request, envKey: string): boolean {
  const expected = process.env[envKey]?.trim();
  if (!expected) return false;

  const authHeader = request.headers.get("Authorization")?.trim() ?? "";
  const received = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!received) return false;

  return secretsEqual(expected, received);
}

http.route({
  path: "/hmrc-sync-trigger",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorizeBearer(request, "SYNC_SECRET")) {
      return new Response("Unauthorized", { status: 401 });
    }

    await ctx.runAction(internal.actions.hmrc.syncAllUsersHMRC, {});

    return new Response(JSON.stringify({ status: "Sync Triggered" }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
  }),
});

http.route({
  path: "/ingest-email",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const ingestSecret = process.env.INGEST_SECRET?.trim();
      if (!ingestSecret) {
        return new Response("Ingest not configured", { status: 503 });
      }

      const provided = request.headers.get("X-Ingest-Secret")?.trim() ?? "";
      if (!secretsEqual(ingestSecret, provided)) {
        return new Response("Unauthorized Ingest", { status: 401 });
      }

      const payload = await request.json();
      
      // Extract the forwarding address (e.g. data+user_xyz@ingest.freightcode.com)
      const toAddress = payload.To || payload.to || "";
      const match = toAddress.match(/data\+(.+)@ingest\.freightcode\.com/i);

      if (!match) {
        return new Response("Invalid destination address", { status: 400 });
      }
      const userId = match[1];

      // Assuming Postmark format: payload.Attachments is an array
      const attachments = payload.Attachments || payload.attachments || [];
      const csvAttachment = attachments.find((a: any) => 
        a.ContentType === "text/csv" || a.Name?.endsWith(".csv")
      );

      if (!csvAttachment) {
        return new Response("No CSV attachment found", { status: 400 });
      }

      // Base64 encoded inside Postmark's Content field
      await ctx.runMutation(internal.ingest.processEmailAttachment, {
        userId,
        attachmentName: csvAttachment.Name,
        base64Content: csvAttachment.Content
      });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Email ingest error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
});

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature", { status: 400 });
    }

    try {
      const body = await request.text();
      await ctx.runAction(internal.actions.stripe.processWebhook, {
        body,
        signature,
      });
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      return new Response("Webhook error", { status: 400 });
    }
  }),
});

export default http;
