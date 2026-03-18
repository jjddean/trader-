import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function findDeclaration() {
  try {
    const lanes = await client.query("trade_lanes:getLanes");
    if (lanes && lanes.length > 0) {
        console.log("Found a valid declaration ID:", lanes[0]._id);
        console.log("Belongs to user:", lanes[0].userId);
    } else {
        console.log("No declarations found in the database. Please create one in the UI first.");
    }
  } catch(e) {
    console.error("Error querying convex:", e);
  }
}
findDeclaration();
