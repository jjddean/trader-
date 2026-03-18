import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function checkToken() {
  const userToTest = "user_2tmqL4aO0I0S8jZl8Jm6pZl3K6P"; // Hardcode just to find the token
  try {
    const tokens = await client.query("hmrc:getToken", { userId: userToTest });
    console.log("Token result length:", tokens ? tokens.accessToken.length : 0);
    console.log("Token exact value: >" + (tokens ? tokens.accessToken : "None") + "<");
  } catch(e) {
    console.error("Error querying convex:", e);
  }
}
checkToken();
