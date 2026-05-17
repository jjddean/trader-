import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { XMLParser } from "fast-xml-parser";

const ODS_PATH = path.resolve("../tmp/hmrc_tdr_audit/CDS_Error_Codes_11-03-2026.ods");
const OUTPUT_PATH = path.resolve("data/hmrc-errors.json");

function extractOdsToTempDir(odsPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hmrc-ods-"));
  try {
    execFileSync("unzip", ["-o", odsPath, "-d", tmpDir], { stdio: "ignore" });
  } catch {
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${odsPath.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}' -Force`,
    ], { stdio: "ignore" });
  }
  return tmpDir;
}

function firstText(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(firstText).join(" ").trim();
  if (typeof node === "object") {
    if ("#text" in node) return String(node["#text"] ?? "");
    return Object.values(node).map(firstText).join(" ").trim();
  }
  return "";
}

const MAX_COLS = 20;
const MAX_ROWS = 2000;

function expandRepeated(items, getRepeatCount, cap) {
  const out = [];
  for (const item of items) {
    const repeat = Math.min(cap, Math.max(1, Number(getRepeatCount(item) ?? 1)));
    for (let i = 0; i < repeat; i++) out.push(item);
  }
  return out;
}

function parseOdsSheet(contentXml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    ignoreDeclaration: true,
    ignorePiTags: true,
    removeNSPrefix: false,
    isArray: (name) =>
      name === "table:table" ||
      name === "table:table-row" ||
      name === "table:table-cell" ||
      name === "text:p",
  });

  const doc = parser.parse(contentXml);
  const spreadsheet =
    doc?.["office:document-content"]?.["office:body"]?.["office:spreadsheet"] ||
    doc?.["office:document"]?.["office:body"]?.["office:spreadsheet"];

  const tables = spreadsheet?.["table:table"] ?? [];
  if (tables.length === 0) throw new Error("No sheets found in ODS file");

  const table = tables[0];
  const rowsRaw = table?.["table:table-row"] ?? [];
  const rowsExpanded = expandRepeated(rowsRaw, (r) => r?.["@_table:number-rows-repeated"], MAX_ROWS);

  return rowsExpanded.map((row) => {
    const cellsRaw = row?.["table:table-cell"] ?? [];
    const cells = expandRepeated(cellsRaw, (c) => c?.["@_table:number-columns-repeated"], MAX_COLS);
    return cells.map((cell) => firstText(cell?.["text:p"]).trim());
  });
}

function convertToErrorRecords(rows) {
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && r.some((c) => c.toLowerCase().includes("error code")),
  );
  if (headerIdx === -1) throw new Error("Could not find header row");

  const records = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const code = (row[0] ?? "").trim();
    const message = (row[1] ?? "").trim();
    const fix = (row[2] ?? "").trim();

    if (!code || !code.startsWith("CDS")) continue;

    const text = `${code} ${message.toLowerCase()} ${fix.toLowerCase()}`.trim();
    records.push({ code, message, fix, text });
  }
  return records;
}

async function main() {
  if (!fs.existsSync(ODS_PATH)) {
    console.error(`ODS file not found: ${ODS_PATH}`);
    process.exit(1);
  }

  console.log(`Extracting ${ODS_PATH}...`);
  const tmpDir = extractOdsToTempDir(ODS_PATH);

  try {
    const contentXml = fs.readFileSync(path.join(tmpDir, "content.xml"), "utf8");
    const rows = parseOdsSheet(contentXml);
    console.log(`Parsed ${rows.length} rows from ODS`);

    const records = convertToErrorRecords(rows);
    console.log(`Extracted ${records.length} error code records`);

    const outDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(records, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
