import fs from "fs";
import path from "path";

const ACCOUNT_ID = "555e307a91082ae8c8e69b0a5ff3b8c3";
const INDEX_NAME = "uk-global-tariff";
const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const DATA_PATH = path.resolve("data/uk-tariff-full.json");
const BATCH_SIZE = 20;

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!API_TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN env var is required");
  process.exit(1);
}

async function generateEmbeddings(texts) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${EMBED_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: texts }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.result.data;
}

async function insertVectors(vectors) {
  const ndjson = vectors
    .map((v) => JSON.stringify({ id: v.id, values: v.values, metadata: v.metadata }))
    .join("\n");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}/insert`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/x-ndjson",
      },
      body: ndjson,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vectorize insert error ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  console.log(`Loaded ${records.length} tariff records`);

  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const texts = batch.map((r) => r.text);

    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)}...`);
    const embeddings = await generateEmbeddings(texts);

    const vectors = batch.map((r, idx) => ({
      id: r.commodity,
      values: embeddings[idx],
      metadata: { commodity: r.commodity, description: r.description, duty: r.duty },
    }));

    const result = await insertVectors(vectors);
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${records.length}`, result);
  }

  console.log(`Seeding complete: ${inserted} vectors inserted into ${INDEX_NAME}`);
}

main();
