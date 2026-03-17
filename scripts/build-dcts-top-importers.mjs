import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const INPUT_FILE = process.env.CDS_DECLARATIONS_FILE
  ? path.resolve(process.env.CDS_DECLARATIONS_FILE)
  : path.join(DATA_DIR, "cds_declarations.json");
const RAW_OUTPUT_FILE = path.join(DATA_DIR, "dcts_top1000_raw.json");
const CLEAN_OUTPUT_FILE = path.join(DATA_DIR, "dcts_top1000_clean.json");
const UNMATCHED_OUTPUT_FILE = path.join(DATA_DIR, "dcts_top1000_unmatched.json");
const SQL_OUTPUT_FILE = path.join(DATA_DIR, "dcts_top1000_importers.sql");
const TOP_N = Number(process.env.TOP_IMPORTERS_LIMIT || 1000);
const LOOKBACK_MONTHS = Number(process.env.LOOKBACK_MONTHS || 24);
const INCLUDE_PRECIOUS = (process.env.INCLUDE_PRECIOUS_METALS || "false").toLowerCase() === "true";
const WRITE_D1 = (process.env.WRITE_D1 || "false").toLowerCase() === "true";
const CH_API_KEY = process.env.COMPANIES_HOUSE_API_KEY || "";
const HMRC_CDS_URL = process.env.HMRC_CDS_DECLARATIONS_URL || "";
const HMRC_CDS_BEARER_TOKEN = process.env.HMRC_CDS_BEARER_TOKEN || "";

const HS_BUCKETS = [
  { label: "Apparel & textiles", hs2: new Set(["52", "54", "55", "61", "62", "63"]) },
  { label: "Food, fish & agriculture", hs2: new Set(["03", "07", "08", "09", "16", "17", "18", "20", "24"]) },
  { label: "Household & consumer goods", hs2: new Set(["40", "42", "44", "46", "64", "94"]) },
  { label: "Electricals & machinery", hs2: new Set(["84", "85"]) },
  { label: "Precious metals & jewellery", hs2: new Set(["71"]) },
];
const EXCLUDED_HS2 = new Set(["27", "72", "73"]);

const ACTIVE_BUCKETS = INCLUDE_PRECIOUS ? HS_BUCKETS : HS_BUCKETS.slice(0, 4);
const HS2_TO_BUCKET = new Map();
for (const bucket of ACTIVE_BUCKETS) {
  for (const code of bucket.hs2) {
    HS2_TO_BUCKET.set(code, bucket.label);
  }
}

const DCTS_COUNTRIES = [
  "Afghanistan",
  "Algeria",
  "Angola",
  "Armenia",
  "Bangladesh",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo",
  "Cook Islands",
  "Democratic Republic of Congo",
  "Djibouti",
  "Eritrea",
  "Ethiopia",
  "Gambia",
  "Guinea",
  "Guinea-Bissau",
  "Haiti",
  "India",
  "Indonesia",
  "Kiribati",
  "Kyrgyzstan",
  "Laos",
  "Lesotho",
  "Liberia",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Micronesia",
  "Mongolia",
  "Mozambique",
  "Myanmar",
  "Nepal",
  "Niger",
  "Nigeria",
  "Niue",
  "Pakistan",
  "Philippines",
  "Rwanda",
  "Samoa",
  "São Tomé and Príncipe",
  "Senegal",
  "Sierra Leone",
  "Solomon Islands",
  "Somalia",
  "South Sudan",
  "Sri Lanka",
  "Sudan",
  "Syria",
  "Tajikistan",
  "Tanzania",
  "Timor-Leste",
  "Togo",
  "Tuvalu",
  "Uganda",
  "Uzbekistan",
  "Vanuatu",
  "Vietnam",
  "Yemen",
  "Zambia",
];

const DCTS_COUNTRY_SET = new Set(DCTS_COUNTRIES.map(normalizeText));

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizePostcode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeHsCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(2, "0");
}

function hs2FromCode(value) {
  const normalized = normalizeHsCode(value);
  if (normalized.length < 2) return "";
  return normalized.slice(0, 2);
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  const compact = String(value).replace(/\D/g, "");
  if (compact.length === 8) {
    const parsed = new Date(`${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function formatAddress(parts) {
  return parts.map((p) => String(p || "").trim()).filter(Boolean).join(", ");
}

function cutoffDate() {
  const now = new Date();
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() - LOOKBACK_MONTHS);
  return d;
}

function recentImportBand(total) {
  if (total < 250000) return "0-250k";
  if (total < 1000000) return "250k-1m";
  return "1m+";
}

function sicIndustryFromCodes(sicCodes) {
  const codes = (sicCodes || []).map((c) => String(c || "").replace(/\D/g, "").slice(0, 5));
  for (const code of codes) {
    const num = Number(code);
    if (!Number.isFinite(num)) continue;
    if ((num >= 46160 && num <= 46190) || (num >= 46410 && num <= 46420) || (num >= 47710 && num <= 47720)) {
      return "Wholesale of clothing and footwear";
    }
    if ((num >= 46310 && num <= 46390) || (num >= 47210 && num <= 47290)) {
      return "Food importers";
    }
    if ((num >= 46440 && num <= 46499) || (num >= 47530 && num <= 47599)) {
      return "Household goods";
    }
    if ((num >= 46510 && num <= 46520) || (num >= 47410 && num <= 47430)) {
      return "Electronics";
    }
    if (num >= 46100 && num <= 46900) {
      return "General wholesale";
    }
  }
  return "Other";
}

async function loadDeclarations() {
  if (fs.existsSync(INPUT_FILE)) {
    const raw = fs.readFileSync(INPUT_FILE, "utf8");
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) return JSON.parse(trimmed);
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  if (HMRC_CDS_URL && HMRC_CDS_BEARER_TOKEN) {
    const url = new URL(HMRC_CDS_URL);
    url.searchParams.set("months", String(LOOKBACK_MONTHS));
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${HMRC_CDS_BEARER_TOKEN}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`CDS fetch failed: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.declarations)) return payload.declarations;
    if (Array.isArray(payload.results)) return payload.results;
    return [];
  }

  throw new Error(
    `No CDS input available. Provide ${INPUT_FILE} or set HMRC_CDS_DECLARATIONS_URL and HMRC_CDS_BEARER_TOKEN.`,
  );
}

function normalizeDeclaration(record) {
  const importerName =
    record.importerName || record.importer_name || record.consigneeName || record.ukImporterName || "";
  const importerEori =
    record.importerEori || record.importer_eori || record.eori || record.ukImporterEori || "";
  const originCountry =
    record.originCountry ||
    record.origin_country ||
    record.countryOfOrigin ||
    record.exporterCountry ||
    record.dispatchCountry ||
    "";
  const commodityCode =
    record.commodityCode || record.hsCode || record.hs_code || record.tariffCode || record.commodity_code || "";
  const importValue =
    record.importValue || record.customsValue || record.valueGbp || record.valueGBP || record.statisticalValue || 0;
  const importDate =
    record.importDate ||
    record.acceptanceDate ||
    record.declarationDate ||
    record.date ||
    record.transactionDate ||
    "";
  const postcode =
    record.importerPostcode || record.postcode || record.importer_postcode || record.addressPostcode || "";
  const address = formatAddress([
    record.importerAddressLine1 || record.addressLine1 || record.importer_address_line_1 || "",
    record.importerAddressLine2 || record.addressLine2 || record.importer_address_line_2 || "",
    record.importerCity || record.city || record.town || "",
    record.importerCounty || record.county || "",
    record.importerPostcode || record.postcode || "",
  ]);
  return {
    importerName: String(importerName || "").trim(),
    importerEori: String(importerEori || "").trim(),
    originCountry: String(originCountry || "").trim(),
    commodityCode: String(commodityCode || "").trim(),
    importValue: parseNumber(importValue),
    importDate: parseDate(importDate),
    postcode: String(postcode || "").trim(),
    address,
  };
}

function aggregateImporters(records) {
  const cutoff = cutoffDate();
  const grouped = new Map();

  for (const raw of records) {
    const row = normalizeDeclaration(raw);
    if (!row.importerName) continue;
    if (!row.importDate || row.importDate < cutoff) continue;
    const countryKey = normalizeText(row.originCountry);
    if (!DCTS_COUNTRY_SET.has(countryKey)) continue;
    const hs2 = hs2FromCode(row.commodityCode);
    if (EXCLUDED_HS2.has(hs2)) continue;
    if (!HS2_TO_BUCKET.has(hs2)) continue;
    if (row.importValue <= 0) continue;

    const stableKey =
      row.importerEori ||
      `${normalizeText(row.importerName)}|${normalizePostcode(row.postcode)}|${normalizeText(row.address)}`;
    if (!stableKey) continue;
    if (!grouped.has(stableKey)) {
      grouped.set(stableKey, {
        key: stableKey,
        importerEori: row.importerEori || null,
        name: row.importerName,
        postcode: row.postcode || null,
        address: row.address || null,
        totalImportValue: 0,
        hs2Breakdown: new Map(),
        dctsCountries: new Set(),
        sectorValue: new Map(),
        lastImportDate: row.importDate,
      });
    }
    const agg = grouped.get(stableKey);
    agg.totalImportValue += row.importValue;
    agg.dctsCountries.add(row.originCountry);
    agg.lastImportDate = agg.lastImportDate > row.importDate ? agg.lastImportDate : row.importDate;
    agg.hs2Breakdown.set(hs2, (agg.hs2Breakdown.get(hs2) || 0) + row.importValue);
    const sector = HS2_TO_BUCKET.get(hs2);
    agg.sectorValue.set(sector, (agg.sectorValue.get(sector) || 0) + row.importValue);
  }

  return Array.from(grouped.values())
    .map((item) => {
      const hs2Breakdown = Array.from(item.hs2Breakdown.entries())
        .map(([hs2, value]) => ({ hs2, value }))
        .sort((a, b) => b.value - a.value);
      const sectorBreakdown = Array.from(item.sectorValue.entries())
        .map(([sector, value]) => ({ sector, value }))
        .sort((a, b) => b.value - a.value);
      return {
        key: item.key,
        importerEori: item.importerEori,
        name: item.name,
        postcode: item.postcode,
        address: item.address,
        totalImportValue: Number(item.totalImportValue.toFixed(2)),
        hs2Breakdown,
        dctsCountries: Array.from(item.dctsCountries).sort(),
        tradeSector: sectorBreakdown[0]?.sector || "Unclassified",
        sectorBreakdown,
        lastImportDate: item.lastImportDate.toISOString().slice(0, 10),
      };
    })
    .filter((item) => item.hs2Breakdown.length > 0 && item.totalImportValue > 0)
    .sort((a, b) => b.totalImportValue - a.totalImportValue)
    .slice(0, TOP_N);
}

function basicAuthHeader(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function companiesHouseGetJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(apiKey),
      Accept: "application/json",
    },
  });
  if (!response.ok) return null;
  return response.json();
}

function companyAddressToString(addressObj) {
  if (!addressObj || typeof addressObj !== "object") return null;
  return formatAddress([
    addressObj.premises,
    addressObj.address_line_1,
    addressObj.address_line_2,
    addressObj.locality,
    addressObj.region,
    addressObj.postal_code,
    addressObj.country,
  ]);
}

async function matchCompaniesHouse(importer) {
  if (!CH_API_KEY) {
    return {
      companyNumber: null,
      companyStatus: null,
      registeredOfficeAddress: importer.address || null,
      sicCodes: [],
      sicIndustry: "Other",
    };
  }

  const query = encodeURIComponent(importer.name);
  const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${query}&items_per_page=10`;
  const searchPayload = await companiesHouseGetJson(searchUrl, CH_API_KEY);
  const items = Array.isArray(searchPayload?.items) ? searchPayload.items : [];
  const importerPostcode = normalizePostcode(importer.postcode);

  const scored = items
    .map((item) => {
      const itemPostcode = normalizePostcode(item?.address?.postal_code || "");
      const titleNorm = normalizeText(item?.title || "");
      const importerNorm = normalizeText(importer.name);
      const postcodeScore = importerPostcode && itemPostcode && importerPostcode === itemPostcode ? 3 : 0;
      const statusScore = item?.company_status === "active" ? 2 : 0;
      const titleScore =
        titleNorm === importerNorm ? 3 : titleNorm.includes(importerNorm) || importerNorm.includes(titleNorm) ? 1 : 0;
      return { item, score: postcodeScore + statusScore + titleScore };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.item;
  if (!best?.company_number) {
    return {
      companyNumber: null,
      companyStatus: null,
      registeredOfficeAddress: importer.address || null,
      sicCodes: [],
      sicIndustry: "Other",
    };
  }

  const profileUrl = `https://api.company-information.service.gov.uk/company/${best.company_number}`;
  const profile = await companiesHouseGetJson(profileUrl, CH_API_KEY);
  const sicCodes = Array.isArray(profile?.sic_codes) ? profile.sic_codes : [];

  return {
    companyNumber: profile?.company_number || best.company_number || null,
    companyStatus: profile?.company_status || best.company_status || null,
    registeredOfficeAddress:
      companyAddressToString(profile?.registered_office_address) ||
      companyAddressToString(best?.address) ||
      importer.address ||
      null,
    sicCodes,
    sicIndustry: sicIndustryFromCodes(sicCodes),
  };
}

async function enrichAndNormalize(topImporters) {
  const clean = [];
  const unmatched = [];

  for (let i = 0; i < topImporters.length; i += 1) {
    const importer = topImporters[i];
    const ch = await matchCompaniesHouse(importer);
    const canonicalName = importer.name;
    const idSeed = ch.companyNumber || importer.key;
    const id = `dcts_${crypto.createHash("md5").update(idSeed).digest("hex")}`;
    const row = {
      id,
      name: canonicalName,
      companyNumber: ch.companyNumber,
      status: ch.companyStatus || "unknown",
      address: ch.registeredOfficeAddress || importer.address || null,
      sicCodes: ch.sicCodes,
      sicIndustry: ch.sicIndustry,
      tradeSector: importer.tradeSector,
      dctsCountries: importer.dctsCountries,
      recentImportBand: recentImportBand(importer.totalImportValue),
      lastImportDate: importer.lastImportDate,
      totalImportValueRecent: importer.totalImportValue,
      hs2Breakdown: importer.hs2Breakdown,
      importerEori: importer.importerEori,
      source: "CDS+CompaniesHouse",
      createdAt: new Date().toISOString(),
    };
    clean.push(row);
    if (!ch.companyNumber) unmatched.push(row);
    if ((i + 1) % 100 === 0 || i + 1 === topImporters.length) {
      console.log(`Enriched ${i + 1}/${topImporters.length}`);
    }
  }

  return { clean, unmatched };
}

function escapeSqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSqlRows(cleanRows) {
  const lines = [];
  lines.push(
    "CREATE TABLE IF NOT EXISTS dcts_importers (id TEXT PRIMARY KEY, name TEXT NOT NULL, company_number TEXT, status TEXT, address TEXT, sic_codes TEXT, sic_industry TEXT, trade_sector TEXT, dcts_countries TEXT, recent_import_band TEXT, last_import_date TEXT, total_import_value_recent REAL, hs2_breakdown TEXT, importer_eori TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
  );
  lines.push("CREATE INDEX IF NOT EXISTS idx_dcts_importers_company_number ON dcts_importers(company_number);");
  lines.push("CREATE INDEX IF NOT EXISTS idx_dcts_importers_trade_sector ON dcts_importers(trade_sector);");
  lines.push("CREATE INDEX IF NOT EXISTS idx_dcts_importers_recent_band ON dcts_importers(recent_import_band);");

  for (const row of cleanRows) {
    lines.push(
      `INSERT OR REPLACE INTO dcts_importers (id, name, company_number, status, address, sic_codes, sic_industry, trade_sector, dcts_countries, recent_import_band, last_import_date, total_import_value_recent, hs2_breakdown, importer_eori, source, created_at) VALUES (${escapeSqlValue(row.id)}, ${escapeSqlValue(row.name)}, ${escapeSqlValue(row.companyNumber)}, ${escapeSqlValue(row.status)}, ${escapeSqlValue(row.address)}, ${escapeSqlValue(JSON.stringify(row.sicCodes || []))}, ${escapeSqlValue(row.sicIndustry)}, ${escapeSqlValue(row.tradeSector)}, ${escapeSqlValue(JSON.stringify(row.dctsCountries || []))}, ${escapeSqlValue(row.recentImportBand)}, ${escapeSqlValue(row.lastImportDate)}, ${escapeSqlValue(row.totalImportValueRecent)}, ${escapeSqlValue(JSON.stringify(row.hs2Breakdown || []))}, ${escapeSqlValue(row.importerEori)}, ${escapeSqlValue(row.source)}, ${escapeSqlValue(row.createdAt)});`,
    );
  }
  return lines.join("\n");
}

function writeOutputs(rawRows, cleanRows, unmatchedRows, sqlText) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RAW_OUTPUT_FILE, JSON.stringify(rawRows, null, 2));
  fs.writeFileSync(CLEAN_OUTPUT_FILE, JSON.stringify(cleanRows, null, 2));
  fs.writeFileSync(UNMATCHED_OUTPUT_FILE, JSON.stringify(unmatchedRows, null, 2));
  fs.writeFileSync(SQL_OUTPUT_FILE, sqlText);
}

function maybeWriteD1() {
  if (!WRITE_D1) return;
  const cmd = `npx wrangler d1 execute companies-db --remote --config "${path.join(ROOT, "cloudagent", "wrangler.toml")}" --file="${SQL_OUTPUT_FILE}" --yes`;
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  console.log("Loading CDS declarations...");
  const declarations = await loadDeclarations();
  console.log(`Loaded declarations: ${declarations.length}`);

  console.log("Aggregating importers by DCTS + sector HS buckets...");
  const topImporters = aggregateImporters(declarations);
  console.log(`Ranked importers selected: ${topImporters.length}`);

  console.log("Enriching with Companies House...");
  const { clean, unmatched } = await enrichAndNormalize(topImporters);
  const sql = buildSqlRows(clean);
  writeOutputs(topImporters, clean, unmatched, sql);

  console.log(`Raw output: ${RAW_OUTPUT_FILE}`);
  console.log(`Clean output: ${CLEAN_OUTPUT_FILE}`);
  console.log(`Unmatched output: ${UNMATCHED_OUTPUT_FILE}`);
  console.log(`SQL output: ${SQL_OUTPUT_FILE}`);
  console.log(`Matched with company number: ${clean.length - unmatched.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  maybeWriteD1();
  if (WRITE_D1) console.log("D1 upsert complete.");
}

main().catch((error) => {
  console.error("Pipeline failed:", error.message);
  process.exit(1);
});
