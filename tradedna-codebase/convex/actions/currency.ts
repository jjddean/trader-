"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const getR2Client = () => {
  return new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
};

export const syncExchangeRates = internalAction({
  handler: async (ctx) => {
    const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
    if (!appId) throw new Error("OPEN_EXCHANGE_RATES_APP_ID is not set");

    console.log("Fetching latest exchange rates from Open Exchange Rates...");
    const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${appId}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch exchange rates: ${error}`);
    }

    const data = await response.json();
    const jsonContent = JSON.stringify(data, null, 2);

    console.log("Uploading exchange rates to Cloudflare R2...");
    const s3 = getR2Client();
    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
    const key = "currency/latest.json";

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: jsonContent,
        ContentType: "application/json",
      }),
    );

    console.log("Updating reference dataset version in Convex...");
    const version = `v${new Date().toISOString().split("T")[0]}`;
    await ctx.runMutation(internal.reference_data.updateDatasetVersion, {
      name: "currency",
      version: version,
      storagePath: `/${key}`,
      storageUrl: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`,
    });

    console.log(`Successfully synced exchange rates (${version})`);
    return { version, key };
  },
});
