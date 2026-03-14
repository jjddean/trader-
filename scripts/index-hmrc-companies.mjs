import { Client as TypesenseClient } from "typesense";
import fs from "fs";
import path from "path";
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
  connectionTimeoutSeconds: 10,
});

const companySchema = {
  name: "companies",
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
    { name: "country", type: "string", facet: true },
    { name: "category", type: "string", facet: true },
    { name: "hscode", type: "string", facet: true },
  ],
};

async function setupIndex() {
  try {
    console.log("Checking if collection exists...");
    await client.collections("companies").retrieve();
    console.log("Collection exists.");
  } catch (err) {
    console.log("Creating collection...");
    await client.collections().create(companySchema);
    console.log("Collection 'companies' created successfully.");
  }
}

async function indexCompanies() {
  const HMR_DATA_FILE = path.resolve("data/companies_hmrc.json");
  console.log(`Reading ${HMR_DATA_FILE}...`);

  if (!fs.existsSync(HMR_DATA_FILE)) {
    console.error("HMRC data file not found.");
    return;
  }

  const companies = JSON.parse(fs.readFileSync(HMR_DATA_FILE, "utf8"));
  console.log(`Indexing ${companies.length} companies...`);

  try {
    // Typesense import is very fast with the 'upsert' or 'create' action
    // For large datasets, it's better to use the documents().import() which handles JSONL or arrays
    const results = await client
      .collections("companies")
      .documents()
      .import(companies, { action: "upsert" });

    const failures = results.filter((res) => res.success === false);
    if (failures.length > 0) {
      console.error(`Failed to index ${failures.length} documents.`);
      console.error(failures[0]); // Log the first error
    } else {
      console.log("Indexing complete successfully.");
    }
  } catch (err) {
    console.error("Error indexing documents:", err);
  }
}

async function main() {
  await setupIndex();
  await indexCompanies();
}

main();
