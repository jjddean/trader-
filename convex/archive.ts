import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const archiveToR2 = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message?: string; archivedCount: number }> => {
    const oldLogs = (await ctx.runQuery(api.audit.getOldLogs)) as any[];
    if (oldLogs.length === 0) return { success: true, message: "No logs to archive", archivedCount: 0 };

    const ndjson = oldLogs.map((log: any) => JSON.stringify(log)).join("\n");
    const fileName = `audit-logs/archive-${Date.now()}.ndjson`;

    if (!process.env.CLOUDFLARE_R2_ENDPOINT) {
        throw new Error("Missing R2 Environment Variables in Convex Dashboard");
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });

    try {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
        Key: fileName,
        Body: ndjson,
        ContentType: "application/x-ndjson",
      }));

      // Map safely using type string to bypass inference issues
      const logIds: any = oldLogs.map((l: any) => l._id);
      await ctx.runMutation(internal.audit.markArchived, { logIds });

      return { success: true, archivedCount: oldLogs.length };
    } catch (error) {
      console.error("Failed to archive logs to R2", error);
      throw new Error("Archival failed");
    }
  }
});
