import { Client as TypesenseClient } from "typesense";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new TypesenseClient({
  nodes: [
    {
      host: process.env.TYPESENSE_NODES?.replace("https://", "").split(":")[1]
        ? process.env.TYPESENSE_NODES.replace("https://", "").split(":")[0]
        : process.env.TYPESENSE_NODES?.replace("https://", "") || "",
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || "",
  connectionTimeoutSeconds: 5,
});

async function verifySearch(query) {
  console.log(`Searching for "${query}"...`);
  try {
    const results = await client.collections("companies").documents().search({
      q: query,
      query_by: "name",
    });
    console.log(`Found ${results.found} matches.`);
    if (results.hits.length > 0) {
      console.log("Top match:");
      console.log(JSON.stringify(results.hits[0].document, null, 2));
    }
  } catch (err) {
    console.error("Search failed:", err);
  }
}

async function main() {
  await verifySearch("COPELAND"); // A company from the sample I saw
  await verifySearch("TEXTILES");
}

main();
