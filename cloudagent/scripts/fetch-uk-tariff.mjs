import fs from "fs";
import path from "path";

const DATASET_URL =
  "https://data.api.trade.gov.uk/v1/datasets/uk-tariff-2021-01-01/versions/latest/tables/commodities-report/data";
const OUT_FILE = path.join(process.cwd(), "data", "uk-tariff-full.json");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || "");
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function codeFrom(row) {
  return String(
    row.commodity__code ||
      row.goods_nomenclature_item_id ||
      row.item_id ||
      row.goods_nomenclature_sid ||
      row.commodity_code ||
      row.code ||
      "",
  ).replace(/\D/g, "");
}

function descriptionFrom(row) {
  return (
    row.description ||
    row.commodity__description ||
    row.formatted_description ||
    row.goods_nomenclature_description ||
    row.description_plain ||
    ""
  );
}

async function fetchCsv(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/csv",
      "User-Agent": "Freightcode tariff data fetcher",
    },
  });
  if (!response.ok) {
    throw new Error(`UK tariff fetch failed (${response.status}): ${await response.text()}`);
  }
  return response.text();
}

async function run() {
  const commodities = [];
  const csv = await fetchCsv(`${DATASET_URL}?format=csv`);
  const rows = parseCsv(csv);

  for (const row of rows) {
    const code = codeFrom(row);
    if (/^\d{10}$/.test(code)) {
      const existing = commodities.find((commodity) => commodity.code === code);
      if (!existing) {
        commodities.push({
          code,
          description: descriptionFrom(row),
          source: "uk-tariff-commodities-report",
        });
      }
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(commodities, null, 2));
  console.log(`Fetched ${commodities.length} UK 10-digit commodity codes to ${OUT_FILE}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
