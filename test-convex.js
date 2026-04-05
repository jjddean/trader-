require("dotenv").config({ path: ".env.local" });
const { ConvexHttpClient } = require("convex/browser");
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

async function test() {
  try {
    console.log("Querying Convex...");
    const result = await client.query("declarations:getAllDecls", {});
    console.log("Success:", JSON.stringify(result, null, 2).substring(0, 500));
  } catch (err) {
    console.error("Convex Query Failed:", err);
  }
}

test();
