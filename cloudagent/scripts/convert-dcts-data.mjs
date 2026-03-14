import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { XMLParser } from "fast-xml-parser";

const DCTS_DIR = path.resolve("data/dcts");
const PSR_PATH = path.join(DCTS_DIR, "psr_ldc.ods");
const TARIFF_PATH = path.join(DCTS_DIR, "tariff_changes.ods");

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function extractOdsToTempDir(odsPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dcts-ods-"));
  const command = `Expand-Archive -LiteralPath ${psQuote(odsPath)} -DestinationPath ${psQuote(tmpDir)} -Force`;
  execFileSync("powershell", ["-NoProfile", "-Command", command], { stdio: "ignore" });
  return tmpDir;
}

function firstText(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return firstText(node[0]);
  if (typeof node === "object") {
    if ("#text" in node) return String(node["#text"] ?? "");
    return (
      Object.values(node)
        .map(firstText)
        .find((v) => v !== "") ?? ""
    );
  }
  return "";
}

function expandRepeated(items, getRepeatCount) {
  const out = [];
  for (const item of items) {
    const repeat = Math.max(1, Number(getRepeatCount(item) ?? 1));
    for (let i = 0; i < repeat; i++) out.push(item);
  }
  return out;
}

function parseOdsSheets(contentXml) {
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
  const result = {};

  for (const table of tables) {
    const sheetName = table?.["@_table:name"] || "Sheet1";
    const rowsRaw = table?.["table:table-row"] ?? [];
    const rowsExpanded = expandRepeated(rowsRaw, (r) => r?.["@_table:number-rows-repeated"]);

    const rows = rowsExpanded.map((row) => {
      const cellsRaw = row?.["table:table-cell"] ?? [];
      const cells = expandRepeated(cellsRaw, (c) => c?.["@_table:number-columns-repeated"]);
      return cells.map((cell) => {
        const p = cell?.["text:p"];
        const text = firstText(p).trim();
        const valueType = cell?.["@_office:value-type"];
        const officeValue = cell?.["@_office:value"];
        if (valueType === "float" && officeValue != null && officeValue !== "") {
          const num = Number(officeValue);
          return Number.isFinite(num) ? num : text;
        }
        return text;
      });
    });

    result[sheetName] = rows;
  }

  return result;
}

function rowsToObjects(rows) {
  const firstNonEmptyRowIndex = rows.findIndex(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""),
  );
  if (firstNonEmptyRowIndex === -1) return [];

  const headerRow = rows[firstNonEmptyRowIndex].map((h, i) => {
    const key = String(h ?? "").trim();
    return key !== "" ? key : `Column${i + 1}`;
  });

  const objects = [];
  for (const row of rows.slice(firstNonEmptyRowIndex + 1)) {
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;
    const obj = {};
    for (let i = 0; i < headerRow.length; i++) {
      obj[headerRow[i]] = row[i] ?? "";
    }
    objects.push(obj);
  }
  return objects;
}

function convertOdsToJson(filePath, outputName) {
  console.log(`Converting ${filePath}...`);
  const tmpDir = extractOdsToTempDir(filePath);
  try {
    const contentXmlPath = path.join(tmpDir, "content.xml");
    const contentXml = fs.readFileSync(contentXmlPath, "utf8");
    const sheets = parseOdsSheets(contentXml);

    const result = {};
    for (const [sheetName, rows] of Object.entries(sheets)) {
      result[sheetName] = rowsToObjects(rows);
    }

    const outputPath = path.join(DCTS_DIR, `${outputName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Saved to ${outputPath}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    if (fs.existsSync(PSR_PATH)) {
      convertOdsToJson(PSR_PATH, "psr_ldc");
    }
    if (fs.existsSync(TARIFF_PATH)) {
      convertOdsToJson(TARIFF_PATH, "tariff_changes");
    }
    console.log("Conversion complete.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
