import fs from "fs";
import path from "path";

const PSR_URL =
  "https://assets.publishing.service.gov.uk/media/62fa6e328fa8f5307a0e807d/product-specific-rules-schedule-for-least-developed-countries.ods";
const TARIFF_CHANGES_URL =
  "https://assets.publishing.service.gov.uk/media/62fa59278fa8f5450779bb58/uk-developing-countries-trading-scheme-dcts-tariff-changes.ods";

const DCTS_DIR = path.resolve("data/dcts");

async function downloadFile(url, fileName) {
  const dest = path.join(DCTS_DIR, fileName);
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
  console.log(`Saved to ${dest}`);
}

async function main() {
  if (!fs.existsSync(DCTS_DIR)) fs.mkdirSync(DCTS_DIR, { recursive: true });

  try {
    await downloadFile(PSR_URL, "psr_ldc.ods");
    await downloadFile(TARIFF_CHANGES_URL, "tariff_changes.ods");
    console.log("DCTS data files downloaded successfully.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
