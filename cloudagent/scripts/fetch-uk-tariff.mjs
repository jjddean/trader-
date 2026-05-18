import fs from "fs";
import path from "path";

const API_BASE = "https://www.trade-tariff.service.gov.uk/api/v2";
const OUTPUT_PATH = path.resolve("data/uk-tariff-full.json");
const DELAY_MS = 250;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        if (res.status === 429 && attempt < retries) {
          console.log(`    Rate limited, waiting ${attempt * 2}s...`);
          await sleep(attempt * 2000);
          continue;
        }
        throw new Error(`API error ${res.status} for ${url}`);
      }
      return res.json();
    } catch (err) {
      if (attempt < retries) {
        console.log(`    Retry ${attempt}/${retries} for ${url}: ${err.message}`);
        await sleep(attempt * 1000);
        continue;
      }
      throw err;
    }
  }
}

function extractDutyFromHeading(headingData, commodityCode) {
  const included = headingData?.included ?? [];
  const measures = included.filter(
    (i) => i.type === "measure" && i.relationships?.goods_nomenclature?.data?.id,
  );
  for (const m of measures) {
    if (m.attributes?.duty_expression?.base) {
      return m.attributes.duty_expression.base;
    }
  }
  return "";
}

async function main() {
  console.log("Fetching UK Trade Tariff data...");

  const allCommodities = [];

  for (let ch = 1; ch <= 97; ch++) {
    const chStr = String(ch).padStart(2, "0");
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

      let headingData;
      try {
        headingData = await fetchJson(`${API_BASE}/headings/${headingId}`);
      } catch (err) {
        console.log(`  Heading ${headingId} fetch failed: ${err.message}`);
        continue;
      }
      if (!headingData) continue;
      await sleep(DELAY_MS);

      const included = headingData.included ?? [];
      const defaultDuty = extractDutyFromHeading(headingData);

      for (const item of included) {
        if (item.type !== "commodity" || !item.attributes) continue;

        const code = item.attributes.goods_nomenclature_item_id ?? "";
        const description = (item.attributes.formatted_description ?? item.attributes.description ?? "")
          .replace(/<[^>]*>/g, "")
          .trim();
        if (!code || !description) continue;

        const duty = defaultDuty || "See full tariff";
        const text = `Commodity ${code} ${description.toLowerCase()}${defaultDuty ? ` duty rate ${defaultDuty}` : ""}`;

        allCommodities.push({ commodity: code, description, duty, text });
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
