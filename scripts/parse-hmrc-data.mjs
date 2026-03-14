import fs from "fs";
import path from "path";
import readline from "readline";
import crypto from "crypto";

const IMPORTERS_FILE = path.resolve("data/hmrc_bulk/importers/importers2512.txt");
const EXPORTERS_FILE = path.resolve("data/hmrc_bulk/exporters/exporters2512.txt");
const OUTPUT_FILE = path.resolve("data/companies_hmrc.json");

async function parseFile(filePath, type) {
  const companies = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  console.log(`Parsing ${filePath}...`);
  let count = 0;

  for await (const line of rl) {
    const parts = line.split("\t").map((p) => p.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
    if (parts.length < 9) continue;

    const name = parts[2];
    const postcode = parts[8];
    const hscode = parts[9] || "";

    if (!name) continue;

    // Generate a stable ID
    const id = crypto.createHash("md5").update(`${name}-${postcode}`).digest("hex");

    companies.push({
      id: `hmrc_${id}`,
      name,
      country: "United Kingdom",
      category: type === "importer" ? "Importer" : "Exporter",
      hscode: hscode.substring(0, 6), // Standard HS6
    });

    count++;
    if (count % 10000 === 0) console.log(`Processed ${count} lines...`);
  }

  return companies;
}

async function main() {
  try {
    const importers = await parseFile(IMPORTERS_FILE, "importer");
    const exporters = await parseFile(EXPORTERS_FILE, "exporter");

    // Combine and de-duplicate by ID
    const combined = new Map();

    importers.forEach((c) => combined.set(c.id, c));
    exporters.forEach((c) => {
      if (combined.has(c.id)) {
        const existing = combined.get(c.id);
        existing.category = "Traded Goods (Imp/Exp)";
      } else {
        combined.set(c.id, c);
      }
    });

    const result = Array.from(combined.values());
    console.log(`Total unique companies found: ${result.length}`);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
