import fs from 'fs';
import path from 'path';

// NextJS logs are typically dumped into the console, but let's see if we can read the raw Convex query to find the actual IDs
import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function checkAllTokens() {
  try {
    // This requires a new generic query or we just read the env vars again
    console.log("HMRC_CLIENT_ID:", !!process.env.HMRC_CLIENT_ID);
    console.log("HMRC_CLIENT_SECRET length:", process.env.HMRC_CLIENT_SECRET ? process.env.HMRC_CLIENT_SECRET.length : 0);
    console.log("HMRC_REDIRECT_URI:", process.env.HMRC_REDIRECT_URI);
  } catch(e) {
    console.error("Error:", e);
  }
}
checkAllTokens();
