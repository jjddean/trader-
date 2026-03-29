import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/hmrc-sync-trigger",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    const syncSecret = process.env.SYNC_SECRET || "default_sync_secret";

    if (authHeader !== `Bearer ${syncSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Trigger the global sync action
    await ctx.runAction(api.actions.hmrc.syncAllUsersHMRC, {
        secret: syncSecret
    });

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
      const payload = await request.json();
      
      // Extract the forwarding address (e.g. data+user_xyz@ingest.freightcode.com)
      const toAddress = payload.To || payload.to || "";
      const match = toAddress.match(/data\+(.+)@ingest\.freightcode\.com/i);
      
      const ingestSecret = request.headers.get("X-Ingest-Secret");
      const expectedSecret = process.env.INGEST_SECRET || "default_ingest_secret";

      if (ingestSecret !== expectedSecret) {
        return new Response("Unauthorized Ingest", { status: 401 });
      }

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

export default http;
