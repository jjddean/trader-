import fs from "fs";
import path from "path";

const INPUT_FILE = path.resolve("data/companies_hmrc.json");
const D1_SQL_FILE = path.resolve("data/companies_hmrc.sql");
const VECTORIZE_JSONL_FILE = path.resolve("data/companies_hmrc.jsonl");

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error("Input file not found.");
    return;
  }

  const companies = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  console.log(`Processing ${companies.length} companies...`);

  // 1. Generate D1 SQL
  // Table schema: CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT, country TEXT, category TEXT, hscode TEXT);
  const sqlHeader =
    "CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT, country TEXT, category TEXT, hscode TEXT);\n";

  // We'll batch inserts for efficiency
  const batchSize = 1000;
  let sqlContent = sqlHeader;

  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const values = batch
      .map(
        (c) =>
          `('${c.id}', '${c.name.replace(/'/g, "''")}', '${c.country}', '${c.category}', '${c.hscode}')`,
      )
      .join(",\n");

    sqlContent += `INSERT OR REPLACE INTO companies (id, name, country, category, hscode) VALUES \n${values};\n`;
    if (i % 10000 === 0) console.log(`SQL: Processed ${i} records...`);
  }

  fs.writeFileSync(D1_SQL_FILE, sqlContent);
  console.log(`Saved D1 SQL to ${D1_SQL_FILE}`);

  // 2. Generate Vectorize JSONL
  // Format: {"id": "hmrc_...", "values": [emb...], "metadata": {"name": "...", ...}}
  // Note: This script just prepares the metadata structure. Real embeddings would require a model call.
  // However, some people use JSONL to bulk upload metadata after generating embeddings.

  let jsonlContent = "";
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const record = {
      id: company.id,
      metadata: {
        name: company.name,
        country: company.country,
        category: company.category,
        hscode: company.hscode,
      },
    };
    jsonlContent += JSON.stringify(record) + "\n";
    if (i % 10000 === 0) console.log(`JSONL: Processed ${i} records...`);
  }

  fs.writeFileSync(VECTORIZE_JSONL_FILE, jsonlContent);
  console.log(`Saved Vectorize JSONL to ${VECTORIZE_JSONL_FILE}`);
}

main();
