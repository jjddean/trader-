import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  },
});

async function syncToR2() {
  const INPUT_FILE = path.resolve("data/companies_hmrc.json");
  if (!fs.existsSync(INPUT_FILE)) {
    console.error("HMRC data file not found.");
    return;
  }

  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || "tradedna";
  const key = "companies/companies_hmrc.json";

  try {
    console.log(`Uploading ${INPUT_FILE} to R2: ${bucketName}/${key}...`);
    const fileBuffer = fs.readFileSync(INPUT_FILE);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: "application/json",
    });

    await r2Client.send(command);
    console.log("✅ HMRC company data synced successfully to R2!");
    console.log(`URL: ${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`);
  } catch (err) {
    console.error("❌ Error uploading to R2:", err);
  }
}

syncToR2();
