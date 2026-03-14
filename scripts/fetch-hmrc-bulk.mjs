import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const IMPORTERS_URL = "https://www.uktradeinfo.com/media/liraiahk/importers2512.zip";
const EXPORTERS_URL = "https://www.uktradeinfo.com/media/bjllr0og/exporters2512.zip";

const DATA_DIR = path.resolve("data/hmrc_bulk");
const TEMP_DIR = path.resolve("data/temp");

async function downloadFile(url, dest) {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
  console.log(`Saved to ${dest}`);
}

function extractZip(zipPath, extractTo) {
  console.log(`Extracting ${zipPath} to ${extractTo}...`);
  if (!fs.existsSync(extractTo)) {
    fs.mkdirSync(extractTo, { recursive: true });
  }

  // Using PowerShell's Expand-Archive since this is a Windows environment
  try {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractTo}' -Force"`,
    );
    console.log("Extraction complete.");
  } catch (error) {
    console.error("Extraction failed:", error.message);
    throw error;
  }
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  const importersZip = path.join(TEMP_DIR, "importers.zip");
  const exportersZip = path.join(TEMP_DIR, "exporters.zip");

  try {
    await downloadFile(IMPORTERS_URL, importersZip);
    await downloadFile(EXPORTERS_URL, exportersZip);

    extractZip(importersZip, path.join(DATA_DIR, "importers"));
    extractZip(exportersZip, path.join(DATA_DIR, "exporters"));

    console.log("HMRC data files downloaded and extracted successfully.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
