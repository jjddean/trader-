import { S3Client, HeadBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

async function main() {
  const endpoint = required("CLOUDFLARE_R2_ENDPOINT");
  const accessKeyId = required("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = required("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = required("CLOUDFLARE_R2_BUCKET_NAME");

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  console.log(`Checking R2 bucket access: ${bucket}`);
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log("HeadBucket: OK");

  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
  const firstKey = list.Contents?.[0]?.Key ?? null;
  console.log(`ListObjectsV2: OK (sample key: ${firstKey ?? "none"})`);
}

main().catch((err) => {
  console.error("R2 verification failed:");
  console.error(err?.message ?? err);
  process.exitCode = 1;
});
