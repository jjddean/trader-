/**
 * debug-payload.js — Freightcode payload inspector (no HMRC call made)
 *
 * Fetches a real declaration + items from Convex, runs the production WCO
 * mapper + XML renderer (same as submit API / CLI runner), and dumps XML.
 *
 * Usage (from repo root):
 *   node test-evidence/debug-payload.js <declarationId> [userId]
 *
 *   OR via env vars:
 *   $env:DECLARATION_ID = "abc123..."; $env:HMRC_TEST_USER_ID = "user_xxx"; node test-evidence/debug-payload.js
 *
 * Outputs:
 *   test-evidence/debug-payload.xml  — the full XML that would be POSTed
 *   test-evidence/debug-report.json  — validation report + field summary
 *   Console                          — human-readable checklist
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });
const { register } = require("tsx/cjs/api");
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

register();
const {
  mapToCDS_H1,
  validateOverseasExporter,
  validateTransactionNatureCode,
} = require("../src/lib/wco-mapper.ts");
const { renderH1Xml, validateXmlPreflight } = require("../src/lib/h1-xml-renderer.ts");
const { validateGoodsLocationForSubmit } = require("../src/lib/goods-location.ts");
const { validateGoodsItemSequences } = require("../src/lib/submit-goods-items.ts");

function validate(declaration, items, xml) {
  const issues = [];
  const warnings = [];

  const eori = String(declaration.eori || "");
  if (!/^GB\d{12}$/.test(eori)) {
    issues.push(`EORI "${eori}" does not match GB + 12 digits`);
  }

  if (!declaration.dispatchCountry) {
    issues.push("Dispatch country (DE 5/14) is blank");
  } else if (String(declaration.dispatchCountry).toUpperCase() === "GB") {
    issues.push('Dispatch country is "GB" — must be the actual country of export for an import');
  }

  if (!declaration.destinationCountry) {
    issues.push("Destination country (DE 5/8) is blank");
  }

  if (!declaration.invoiceCurrency) {
    issues.push("Invoice currency (DE 4/11) is blank");
  }

  issues.push(...validateGoodsLocationForSubmit(declaration));
  issues.push(...validateOverseasExporter(declaration));
  issues.push(...validateTransactionNatureCode(declaration));
  issues.push(...validateGoodsItemSequences(items));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const code = String(item.commodityCode || item.hsCode || "");
    if (!/^\d{8,10}$/.test(code.replace(/\s+/g, ""))) {
      issues.push(`Item ${i + 1}: commodity code "${code}" is not 8–10 digits`);
    }
    const cpc = String(item.procedureCode || "").replace(/\s+/g, "");
    if (!/^\d{4}$/.test(cpc)) {
      issues.push(`Item ${i + 1}: procedure code "${cpc}" is not 4 digits`);
    }
    if (!item.originCountry) {
      issues.push(`Item ${i + 1}: originCountry is blank (DE 5/15 mandatory)`);
    }
    if (!item.description) {
      warnings.push(`Item ${i + 1}: description is blank`);
    }

    const docs = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
    if (docs.length === 0) {
      warnings.push(`Item ${i + 1}: no additionalDocuments on row`);
    } else {
      docs.forEach((doc, di) => {
        const cat = String(doc.CategoryCode || doc.categoryCode || "");
        const type = String(doc.TypeCode || doc.typeCode || "");
        const id = String(doc.ID || doc.id || "");
        if (!cat || !type || !id) {
          issues.push(
            `Item ${i + 1}, Doc ${di + 1}: incomplete — CategoryCode="${cat}" TypeCode="${type}" ID="${id}"`,
          );
        }
      });
    }
  }

  const preflight = validateXmlPreflight(xml, eori);
  if (!preflight.valid) {
    for (const check of preflight.failed) {
      issues.push(`XML preflight failed: ${check}`);
    }
  }

  if (xml.includes("<TypeCode>922</TypeCode>")) {
    issues.push("Y922 found in XML — withdrawn code");
  }

  return { issues, warnings };
}

async function run() {
  const declarationId = process.argv[2] || process.env.DECLARATION_ID;
  const userId = process.argv[3] || process.env.HMRC_TEST_USER_ID || process.env.HMRC_USER_ID;

  if (!declarationId) {
    console.error("Usage: node test-evidence/debug-payload.js <declarationId> [userId]");
    console.error("   or: $env:DECLARATION_ID='jx7...'; node test-evidence/debug-payload.js");
    process.exit(1);
  }
  if (!userId) {
    console.error("No userId provided. Pass as second arg or set HMRC_TEST_USER_ID in .env.local");
    process.exit(1);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("NEXT_PUBLIC_CONVEX_URL not set — check .env.local");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  console.log(`\nFetching declaration ${declarationId} for user ${userId}...`);

  const declaration = await client.query(api.declarations.getForDebug, {
    id: declarationId,
    userId,
  });

  if (!declaration) {
    console.error("Declaration not found or userId does not match owner. Check the ID and HMRC_TEST_USER_ID.");
    process.exit(1);
  }

  const items = await client.query(api.goods_items.getItemsForDebug, {
    declarationId,
    userId,
  });

  console.log(`Found: declaration (status="${declaration.status}"), ${items.length} item(s)\n`);

  let payloadInfo;
  try {
    payloadInfo = mapToCDS_H1(declaration, items);
  } catch (err) {
    console.error("\n[MAPPER ERROR]", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const xml = renderH1Xml(payloadInfo);
  const { issues, warnings } = validate(declaration, items, xml);

  const PASS = "  [PASS]";
  const FAIL = "  [FAIL]";
  const WARN = "  [WARN]";

  console.log("=".repeat(60));
  console.log("  DECLARATION FIELD SUMMARY");
  console.log("=".repeat(60));
  console.log(`  EORI                 : ${declaration.eori || "(blank)"}`);
  console.log(`  Dispatch Country     : ${declaration.dispatchCountry || "(blank)"}`);
  console.log(`  Transaction Nature   : ${declaration.transactionNatureCode || "(blank)"}`);
  console.log(`  Declaration Type     : ${declaration.declarationType || "(blank)"}`);
  console.log(`  Status               : ${declaration.status || "(blank)"}`);
  console.log(`  MRN                  : ${declaration.mrn || "(none)"}`);
  console.log(`  Conversation ID      : ${declaration.conversationId || "(none)"}`);
  console.log("");
  console.log("=".repeat(60));
  console.log("  ITEMS");
  console.log("=".repeat(60));
  items.forEach((item, i) => {
    const docs = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
    const docSummary = docs.length > 0
      ? docs.map((d) => `${d.CategoryCode || ""}${d.TypeCode || ""}:${d.ID || ""}`).join(", ")
      : "(none)";
    console.log(`  Item ${i + 1}:`);
    console.log(`    HS Code    : ${item.commodityCode || "(blank)"}`);
    console.log(`    Description: ${item.description || "(blank)"}`);
    console.log(`    Origin     : ${item.originCountry || "(blank)"}`);
    console.log(`    CPC (1/10) : ${item.procedureCode || "(blank)"}`);
    console.log(`    APC (1/11) : ${item.additionalProcedureCode || "000"}`);
    console.log(`    Value      : ${item.valueAmount} ${item.valueCurrency || "GBP"}`);
    console.log(`    Gross KG   : ${item.grossWeightKg ?? "(missing)"}`);
    console.log(`    Docs       : ${docSummary}`);
  });
  console.log("");
  console.log("=".repeat(60));
  console.log("  VALIDATION (production mapper + preflight)");
  console.log("=".repeat(60));
  if (issues.length === 0 && warnings.length === 0) {
    console.log(`${PASS} All checks passed`);
  }
  issues.forEach((msg) => console.log(`${FAIL} ${msg}`));
  warnings.forEach((msg) => console.log(`${WARN} ${msg}`));
  console.log("");

  const overall = issues.length === 0 ? "READY" : "BLOCKED";
  console.log(`  Overall: ${overall} (${issues.length} error(s), ${warnings.length} warning(s))`);
  console.log("");

  const evidenceDir = path.join(process.cwd(), "test-evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const xmlFile = path.join(evidenceDir, "debug-payload.xml");
  const reportFile = path.join(evidenceDir, "debug-report.json");

  fs.writeFileSync(
    xmlFile,
    `<!-- generated: ${new Date().toISOString()} | declarationId: ${declarationId} | mapper: src/lib/wco-mapper.ts -->\n${xml}`,
  );
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        declarationId,
        userId,
        overall,
        mapper: "src/lib/wco-mapper.ts",
        renderer: "src/lib/h1-xml-renderer.ts",
        issues,
        warnings,
        declaration: {
          eori: declaration.eori,
          dispatchCountry: declaration.dispatchCountry,
          transactionNatureCode: declaration.transactionNatureCode,
          declarationType: declaration.declarationType,
          status: declaration.status,
          mrn: declaration.mrn,
          conversationId: declaration.conversationId,
        },
        items: items.map((item, i) => ({
          seq: i + 1,
          commodityCode: item.commodityCode,
          description: item.description,
          originCountry: item.originCountry,
          procedureCode: item.procedureCode,
          additionalProcedureCode: item.additionalProcedureCode,
          valueAmount: item.valueAmount,
          valueCurrency: item.valueCurrency,
          grossWeightKg: item.grossWeightKg,
          additionalDocuments: item.additionalDocuments || [],
        })),
      },
      null,
      2,
    ),
  );

  console.log(`  XML  → test-evidence/debug-payload.xml`);
  console.log(`  JSON → test-evidence/debug-report.json`);
  console.log("");

  if (issues.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("\n[ERROR]", err.message || err);
  process.exit(1);
});
