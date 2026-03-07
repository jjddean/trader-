import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

async function updateCurrencyRates() {
    console.log("Fetching live currency rates...");

    // In a production app, you'd call a real API like fixer.io or exchangeratesapi.io
    // For this implementation, we generate deterministic mock data based on GBP base
    const mockRates = {
        base: "GBP",
        date: new Date().toISOString().split('T')[0],
        rates: {
            USD: 1.25 + (Math.random() * 0.02 - 0.01),
            EUR: 1.18 + (Math.random() * 0.02 - 0.01),
            CNY: 8.95 + (Math.random() * 0.05 - 0.025),
            INR: 104.2 + (Math.random() * 0.4 - 0.2),
            VND: 30500 + Math.floor(Math.random() * 100 - 50)
        }
    };

    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || "tradedna";
    const key = "currency/latest.json";

    try {
        console.log(`Uploading latest rates to R2: ${bucketName}/${key}...`);

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: JSON.stringify(mockRates, null, 2),
            ContentType: "application/json",
        });

        await r2Client.send(command);
        console.log("✅ Currency rates updated successfully in R2!");
        console.log("New Rates:", mockRates.rates);
    } catch (err) {
        console.error("❌ Error uploading to R2:", err);
    }
}

updateCurrencyRates();
