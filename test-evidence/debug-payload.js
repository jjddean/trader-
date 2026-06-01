/**
 * debug-payload.js — Freightcode payload inspector (no HMRC call made)
 *
 * Fetches a real declaration + items from Convex, runs the WCO mapper,
 * validates all CDS fields, and dumps the full XML so you can see exactly
 * what would be sent to HMRC before pressing Submit.
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
const { ConvexHttpClient } = require("convex/browser");
const { api } = require("../convex/_generated/api");

// ─── helpers ────────────────────────────────────────────────────────────────

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** DE 5/23 split — must match src/lib/goods-location.ts (see spec/de-5-23-goods-location.md). */
function splitConsolidatedLocationCode(code) {
  const clean = String(code || "").trim().toUpperCase();
  if (clean.length < 5) return null;
  return {
    country: clean.slice(0, 2),
    typeCode: clean.slice(2, 3),
    qualifierCode: clean.slice(3, 4),
    codedId: clean.slice(4),
  };
}

function resolveGoodsLocation(declaration) {
  const locationId = String(declaration.locationId || "GBAUFXTFXTFXT").trim().toUpperCase();
  const split = splitConsolidatedLocationCode(locationId);
  if (!split) {
    return { Name: "", ID: locationId, TypeCode: "", Address: null };
  }
  return {
    Name: "",
    ID: split.codedId,
    TypeCode: split.typeCode,
    Address: { TypeCode: split.qualifierCode, CountryCode: split.country },
  };
}

function mapToCDS_H1(declaration, items) {
  const totalGrossWeight =
    items.reduce((acc, item) => acc + (parseFloat(item.grossWeightKg) || 0), 0) || 100;
  const invoiceTotal =
    items.reduce((acc, item) => acc + (parseFloat(item.valueAmount) || 0), 0) || 1000;

  return {
    Declaration: {
      FunctionCode: "9",
      TypeCode: "IMA",
      FunctionalReferenceID: declaration.lrn || `FC-${declaration._id}`,
      GoodsItemQuantity: items.length || 1,
      DeclarationOfficeID: declaration.presentationOffice || "GB000051",
      TotalGrossMassMeasure: declaration.totalGrossWeight || totalGrossWeight,
      TotalPackageQuantity: items.reduce(
        (acc, item) => acc + (parseInt(item.packageCount) || 1),
        0,
      ),
      InvoiceAmount: {
        currencyID: declaration.invoiceCurrency || "GBP",
        value: declaration.invoiceTotal || invoiceTotal,
      },
      Declarant: { ID: declaration.eori || "" },
      Exporter: /^(GB|XI)\d{12}$/i.test(declaration.exporterEori || "")
        ? { ID: declaration.exporterEori }
        : null,
      UCR: {
        TraderAssignedReferenceID:
          declaration.ducr ||
          `${new Date().getFullYear() % 10}GB${(declaration.eori || "GB000000000000").replace(/^GB/i, "")}-${String(declaration._id).substring(0, 6).toUpperCase()}`,
      },
      GoodsShipment: {
        Consignment: {
          ContainerCode: "0",
          BorderTransportMeans: {
            IdentificationTypeCode: "11",
            ID: declaration.transportId || "CSCL GLOBE",
            ModeCode: declaration.transportMode || "1",
          },
          GoodsLocation: resolveGoodsLocation(declaration),
        },
        Destination: { CountryCode: declaration.destinationCountry || "GB" },
        ExportCountry: { ID: declaration.dispatchCountry || "" },
        Importer: { ID: declaration.importerEori || declaration.eori || "" },
        TradeTerms: {
          ConditionCode: declaration.incoterms || "FOB",
          LocationID: declaration.incotermLocation || "GBFXT",
        },
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => {
          const providedDocs = Array.isArray(item.additionalDocuments)
            ? item.additionalDocuments
            : [];
          const mappedDocs = providedDocs
            .map((doc) => {
              const s = typeof doc === "object" && doc !== null ? doc : {};
              return {
                CategoryCode: String(s.CategoryCode || s.categoryCode || "").trim(),
                TypeCode: String(s.TypeCode || s.typeCode || "").trim(),
                ID: String(s.ID || s.id || "").trim(),
                StatusCode: String(s.StatusCode || s.statusCode || "").trim(),
              };
            })
            .filter((d) => d.CategoryCode && d.TypeCode && d.ID);

          return {
            SequenceNumeric: item.sequenceNumber || index + 1,
            AdditionalDocument: mappedDocs,
            StatisticalValueAmount: {
              currencyID: item.valueCurrency || "GBP",
              value: item.valueAmount || 0,
            },
            Commodity: {
              Description: item.description || "General goods",
              Classification: [
                {
                  ID: item.commodityCode || item.hsCode || "",
                  IdentificationTypeCode: "TSP",
                },
              ],
              GoodsMeasure: {
                GrossMassMeasure: item.grossWeightKg || 10,
                NetNetWeightMeasure: item.netWeightKg || 9,
              },
            },
            Packaging: [
              {
                SequenceNumeric: "1",
                MarksNumbersID: item.shippingMarks || "N/A",
                QuantityQuantity: item.packageCount || "1",
                TypeCode: item.packageType || "PK",
              },
            ],
            ...(item.originCountry
              ? { Origin: { CountryCode: item.originCountry, TypeCode: "1" } }
              : {}),
            GovernmentProcedure: [
              {
                CurrentCode: (item.procedureCode?.replace(/\s+/g, "") || "4000").substring(0, 2),
                PreviousCode: (item.procedureCode?.replace(/\s+/g, "") || "4000").substring(2, 4) || "00",
              },
              {
                CurrentCode: item.additionalProcedureCode || "000",
              },
            ],
          };
        }),
      },
    },
  };
}

function buildXml(p) {
  const d = p.Declaration;
  const gs = d.GoodsShipment;
  const exporterXml = d.Exporter
    ? `\n    <Exporter>\n      <ID>${xmlEscape(d.Exporter.ID)}</ID>\n    </Exporter>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2 ../DocumentMetaData_2_DMS.xsd ">
    <FunctionCode>${xmlEscape(d.FunctionCode)}</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(d.FunctionalReferenceID)}</FunctionalReferenceID>
    <TypeCode>${xmlEscape(d.TypeCode)}</TypeCode>
    <GoodsItemQuantity>${xmlEscape(d.GoodsItemQuantity)}</GoodsItemQuantity>
    <DeclarationOfficeID>${xmlEscape(d.DeclarationOfficeID)}</DeclarationOfficeID>
    <InvoiceAmount currencyID="${xmlEscape(d.InvoiceAmount.currencyID)}">${xmlEscape(d.InvoiceAmount.value)}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(d.TotalGrossMassMeasure)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>
    <Declarant>
      <ID>${xmlEscape(d.Declarant.ID)}</ID>
    </Declarant>${exporterXml}
    <GoodsShipment>
      <Consignment>
        <ContainerCode>${xmlEscape(gs.Consignment.ContainerCode)}</ContainerCode>
        <ArrivalTransportMeans>
          <ID>${xmlEscape(gs.Consignment.BorderTransportMeans.ID)}</ID>
          <IdentificationTypeCode>${xmlEscape(gs.Consignment.BorderTransportMeans.IdentificationTypeCode)}</IdentificationTypeCode>
          <ModeCode>${xmlEscape(gs.Consignment.BorderTransportMeans.ModeCode)}</ModeCode>
        </ArrivalTransportMeans>
        ${(() => {
          const gl = gs.Consignment.GoodsLocation || {};
          const idXml = gl.ID ? `<ID>${xmlEscape(gl.ID)}</ID>` : "";
          const typeXml = gl.TypeCode ? `<TypeCode>${xmlEscape(gl.TypeCode)}</TypeCode>` : "";
          const addr = gl.Address;
          const addressXml =
            addr && (addr.TypeCode || addr.CountryCode)
              ? `<Address>${addr.TypeCode ? `<TypeCode>${xmlEscape(addr.TypeCode)}</TypeCode>` : ""}${addr.CountryCode ? `<CountryCode>${xmlEscape(addr.CountryCode)}</CountryCode>` : ""}</Address>`
              : "";
          return `<GoodsLocation>${idXml}${typeXml}${addressXml}</GoodsLocation>`;
        })()}
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(gs.Destination.CountryCode)}</CountryCode>
      </Destination>
      <ExportCountry>
        <ID>${xmlEscape(gs.ExportCountry.ID)}</ID>
      </ExportCountry>
      <Importer>
        <ID>${xmlEscape(gs.Importer.ID)}</ID>
      </Importer>
      <TradeTerms>
        <ConditionCode>${xmlEscape(gs.TradeTerms.ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(gs.TradeTerms.LocationID)}</LocationID>
      </TradeTerms>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(d.UCR.TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
      <Warehouse>
        <ID>${xmlEscape(d.Declarant.ID)}</ID>
        <TypeCode>U</TypeCode>
      </Warehouse>
      ${(gs.GovernmentAgencyGoodsItem || []).map((item) => {
        const docs = Array.isArray(item.AdditionalDocument) ? item.AdditionalDocument : [];
        const docsXml = docs
          .map(
            (doc) => `
        <AdditionalDocument>
          <CategoryCode>${xmlEscape(doc.CategoryCode)}</CategoryCode>
          <ID>${xmlEscape(doc.ID)}</ID>
          <TypeCode>${xmlEscape(doc.TypeCode)}</TypeCode>
          ${doc.StatusCode ? `<LPCOExemptionCode>${xmlEscape(doc.StatusCode)}</LPCOExemptionCode>` : ""}
        </AdditionalDocument>`,
          )
          .join("");
        const procs = Array.isArray(item.GovernmentProcedure) ? item.GovernmentProcedure : [];
        const procsXml = procs
          .map(
            (p) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(p.CurrentCode)}</CurrentCode>
          ${p.PreviousCode ? `<PreviousCode>${xmlEscape(p.PreviousCode)}</PreviousCode>` : ""}
        </GovernmentProcedure>`,
          )
          .join("");
        const pkg = Array.isArray(item.Packaging) && item.Packaging[0]
          ? item.Packaging[0]
          : { SequenceNumeric: "1", MarksNumbersID: "N/A", QuantityQuantity: "1", TypeCode: "PK" };
        const originXml = item.Origin?.CountryCode
          ? `\n        <Origin>\n          <CountryCode>${xmlEscape(item.Origin.CountryCode)}</CountryCode>\n          <TypeCode>${xmlEscape(item.Origin.TypeCode || "1")}</TypeCode>\n        </Origin>`
          : "";
        return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(item.SequenceNumeric)}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${xmlEscape(item.StatisticalValueAmount.currencyID)}">${xmlEscape(item.StatisticalValueAmount.value)}</StatisticalValueAmount>
        ${docsXml}
        <Commodity>
          <Description>${xmlEscape(item.Commodity.Description)}</Description>
          <Classification>
            <ID>${xmlEscape(item.Commodity.Classification[0].ID)}</ID>
            <IdentificationTypeCode>${xmlEscape(item.Commodity.Classification[0].IdentificationTypeCode)}</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.GrossMassMeasure)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(item.Commodity.GoodsMeasure.NetNetWeightMeasure)}</NetNetWeightMeasure>
          </GoodsMeasure>
        </Commodity>
        ${procsXml}${originXml}
        <Packaging>
          <SequenceNumeric>${xmlEscape(pkg.SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(pkg.MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(pkg.QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(pkg.TypeCode)}</TypeCode>
        </Packaging>
      </GovernmentAgencyGoodsItem>`;
      }).join("")}
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}

function validate(declaration, items, xml) {
  const issues = [];
  const warnings = [];

  const eori = String(declaration.eori || "");
  if (!/^GB\d{12}$/.test(eori)) {
    issues.push(`EORI "${eori}" does not match GB + 12 digits`);
  }

  const dispatch = String(declaration.dispatchCountry || "");
  if (!dispatch) {
    issues.push("Dispatch country (DE 5/14) is blank — set the country goods were shipped FROM");
  } else if (dispatch.toUpperCase() === "GB") {
    issues.push('Dispatch country is "GB" — must be the actual country of export, never GB for an import');
  }

  const locationId = String(declaration.locationId || "").trim().toUpperCase();
  if (locationId === "GBAUFXTFXTGW" || locationId === "GBWLAFXTFXTGW") {
    issues.push(
      `Goods location "${locationId}" is invalid — use GBAUFXTFXTFXT (Appendix 16C ODS). See spec/lane.md.`,
    );
  }
  if (locationId && !splitConsolidatedLocationCode(locationId)) {
    issues.push(`Goods location "${locationId}" cannot be split into Country+Type+Qualifier+CodedID`);
  }

  if (!xml.includes("<AdditionalDocument>")) {
    issues.push("No AdditionalDocument elements — at least one document code is required (e.g. N853, Y929)");
  }

  if (xml.includes("<TypeCode>922</TypeCode>")) {
    issues.push("Y922 found in XML — this code was withdrawn; replace with Y929/Y930 as appropriate");
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const code = String(item.commodityCode || item.hsCode || "");
    if (!/^\d{10}$/.test(code)) {
      issues.push(`Item ${i + 1}: commodity code "${code}" is not 10 digits`);
    }
    const cpc = String(item.procedureCode || "").replace(/\s+/g, "");
    if (!/^\d{4}$/.test(cpc)) {
      issues.push(`Item ${i + 1}: procedure code "${cpc}" is not 4 digits`);
    }
    const apc = String(item.additionalProcedureCode || "000");
    if (!/^\d{3}$/.test(apc)) {
      warnings.push(`Item ${i + 1}: additional procedure code "${apc}" should be 3 digits`);
    }
    if (!item.originCountry) {
      warnings.push(`Item ${i + 1}: originCountry is blank — DE 5/16 required for most H1 imports`);
    }
    if (!item.grossWeightKg && item.grossWeightKg !== 0) {
      warnings.push(`Item ${i + 1}: grossWeightKg is missing — will default to 10 kg`);
    }
    if (!item.netWeightKg && item.netWeightKg !== 0) {
      warnings.push(`Item ${i + 1}: netWeightKg is missing — will default to 9 kg`);
    }

    const docs = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
    if (docs.length === 0) {
      warnings.push(`Item ${i + 1}: no additionalDocuments set — signed document matrix may be needed`);
    } else {
      docs.forEach((doc, di) => {
        const cat = String(doc.CategoryCode || "");
        const type = String(doc.TypeCode || "");
        const id = String(doc.ID || "");
        if (!cat || !type || !id) {
          issues.push(`Item ${i + 1}, Doc ${di + 1}: incomplete — got CategoryCode="${cat}" TypeCode="${type}" ID="${id}"`);
        }
      });
    }
  }

  return { issues, warnings };
}

// ─── main ────────────────────────────────────────────────────────────────────

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

  // ── Build XML ──
  const payloadInfo = mapToCDS_H1(declaration, items);
  const xml = buildXml(payloadInfo);

  // ── Validate ──
  const { issues, warnings } = validate(declaration, items, xml);

  // ── Print checklist ──
  const PASS = "  [PASS]";
  const FAIL = "  [FAIL]";
  const WARN = "  [WARN]";

  console.log("=".repeat(60));
  console.log("  DECLARATION FIELD SUMMARY");
  console.log("=".repeat(60));
  console.log(`  EORI            : ${declaration.eori || "(blank)"}`);
  console.log(`  Dispatch Country: ${declaration.dispatchCountry || "(blank)"}`);
  console.log(`  Declaration Type: ${declaration.declarationType || "(blank)"}`);
  console.log(`  Status          : ${declaration.status || "(blank)"}`);
  console.log(`  MRN             : ${declaration.mrn || "(none)"}`);
  console.log(`  Conversation ID : ${declaration.conversationId || "(none)"}`);
  console.log("");
  console.log("=".repeat(60));
  console.log("  ITEMS");
  console.log("=".repeat(60));
  items.forEach((item, i) => {
    const docs = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
    const docSummary = docs.length > 0
      ? docs.map((d) => `${d.CategoryCode}${d.TypeCode}:${d.ID}`).join(", ")
      : "(none)";
    console.log(`  Item ${i + 1}:`);
    console.log(`    HS Code    : ${item.commodityCode || "(blank)"}`);
    console.log(`    Description: ${item.description || "(blank)"}`);
    console.log(`    Origin     : ${item.originCountry || "(blank)"}`);
    console.log(`    CPC (1/10) : ${item.procedureCode || "(blank)"}`);
    console.log(`    APC (1/11) : ${item.additionalProcedureCode || "000"}`);
    console.log(`    Value      : ${item.valueAmount} ${item.valueCurrency || "GBP"}`);
    console.log(`    Gross KG   : ${item.grossWeightKg ?? "(missing)"}`);
    console.log(`    Net KG     : ${item.netWeightKg ?? "(missing)"}`);
    console.log(`    Docs       : ${docSummary}`);
  });
  console.log("");
  console.log("=".repeat(60));
  console.log("  VALIDATION");
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

  // ── Write files ──
  const evidenceDir = path.join(process.cwd(), "test-evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });

  const xmlFile = path.join(evidenceDir, "debug-payload.xml");
  const reportFile = path.join(evidenceDir, "debug-report.json");

  fs.writeFileSync(xmlFile, `<!-- generated: ${new Date().toISOString()} | declarationId: ${declarationId} -->\n${xml}`);
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        declarationId,
        userId,
        overall,
        issues,
        warnings,
        declaration: {
          eori: declaration.eori,
          dispatchCountry: declaration.dispatchCountry,
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
          netWeightKg: item.netWeightKg,
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
