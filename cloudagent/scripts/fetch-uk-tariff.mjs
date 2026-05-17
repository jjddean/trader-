import fs from "fs";
import path from "path";

const API_BASE = "https://www.trade-tariff.service.gov.uk/api/v2";
const OUTPUT_PATH = path.resolve("data/uk-tariff-full.json");
const DELAY_MS = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`API error ${res.status} for ${url}: ${await res.text()}`);
  }
  return res.json();
}

function extractDutyRate(commodity) {
  const measures = commodity?.data?.attributes?.import_measures ?? commodity?.included ?? [];
  for (const m of measures) {
    if (m?.type === "measure" && m?.attributes?.duty_expression?.base) {
      return m.attributes.duty_expression.base;
    }
  }
  return "";
}

async function fetchHeadingCommodities(headingId) {
  const data = await fetchJson(`${API_BASE}/headings/${headingId}`);
  if (!data) return [];

  const commodities = [];
  const included = data.included ?? [];

  for (const item of included) {
    if (item.type === "commodity" && item.attributes) {
      const code = item.attributes.goods_nomenclature_item_id ?? "";
      const description = (item.attributes.formatted_description ?? item.attributes.description ?? "")
        .replace(/<[^>]*>/g, "")
        .trim();
      if (code && description) {
        commodities.push({ code, description, leaf: item.attributes.leaf ?? false });
      }
    }
  }

  return commodities;
}

async function fetchCommodityDuty(commodityId) {
  const data = await fetchJson(`${API_BASE}/commodities/${commodityId}`);
  if (!data) return "";

  const included = data.included ?? [];
  for (const item of included) {
    if (item.type === "duty_expression" && item.attributes?.base) {
      return item.attributes.base;
    }
    if (item.type === "measure" && item.attributes?.duty_expression?.base) {
      return item.attributes.duty_expression.base;
    }
  }

  const dutyExpr = data?.data?.attributes?.duty_expression?.base;
  if (dutyExpr) return dutyExpr;

  return "";
}

async function main() {
  console.log("Fetching UK Trade Tariff data...");

  const allCommodities = [];
  const chapters = [];

  for (let ch = 1; ch <= 97; ch++) {
    const chStr = String(ch).padStart(2, "0");
    chapters.push(chStr);
  }

  for (const chStr of chapters) {
    console.log(`Chapter ${chStr}/97...`);
    const chapterData = await fetchJson(`${API_BASE}/chapters/${chStr}`);
    if (!chapterData) {
      console.log(`  Chapter ${chStr} not found, skipping`);
      continue;
    }
    await sleep(DELAY_MS);

    const headings = (chapterData.included ?? []).filter((i) => i.type === "heading");
    console.log(`  Found ${headings.length} headings`);

    for (const heading of headings) {
      const headingId = heading.attributes?.goods_nomenclature_item_id?.slice(0, 4) ?? heading.id;
      if (!headingId) continue;

      const commodities = await fetchHeadingCommodities(headingId);
      await sleep(DELAY_MS);

      const leafCommodities = commodities.filter((c) => c.leaf);
      const toFetch = leafCommodities.length > 0 ? leafCommodities : commodities.slice(0, 10);

      for (const comm of toFetch) {
        let duty = "";
        try {
          duty = await fetchCommodityDuty(comm.code);
          await sleep(DELAY_MS);
        } catch (err) {
          console.log(`    Duty fetch failed for ${comm.code}: ${err.message}`);
        }

        const text = `Commodity ${comm.code} ${comm.description.toLowerCase()}${duty ? ` duty rate ${duty}` : ""}`;
        allCommodities.push({
          commodity: comm.code,
          description: comm.description,
          duty: duty || "See full tariff",
          text,
        });
      }
    }

    console.log(`  Total commodities so far: ${allCommodities.length}`);
  }

  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allCommodities, null, 2));
  console.log(`Saved ${allCommodities.length} commodities to ${OUTPUT_PATH}`);
}

main();
