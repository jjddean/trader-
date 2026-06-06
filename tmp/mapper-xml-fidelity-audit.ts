/**
 * JSON (mapToCDS_H1) → XML (renderH1Xml) fidelity audit for CDS12073 workstream.
 * Run: npx tsx tmp/mapper-xml-fidelity-audit.ts
 */
import { mapToCDS_H1 } from "../src/lib/wco-mapper";
import { renderH1Xml } from "../src/lib/h1-xml-renderer";

const laneDecl = {
  _id: "fc-mpugj6m8",
  eori: "GB553202734852",
  importerEori: "GB553202734852",
  lrn: "FC-MPUGJ6M8",
  destinationCountry: "GB",
  dispatchCountry: "DE",
  presentationOffice: "GBLON004",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  invoiceCurrency: "GBP",
  invoiceTotal: 5000,
  incoterms: "CIF",
  incotermLocation: "Felixstowe",
  transportMode: "1",
  transportIdType: "11",
  transportId: "CSCL GLOBE",
  totalGrossWeight: 120,
};

const laneItem = {
  sequenceNumber: 1,
  commodityCode: "8471300000",
  description: "Portable automatic data processing machine",
  originCountry: "DE",
  procedureCode: "4000",
  additionalProcedureCode: "000",
  valueAmount: 5000,
  valueCurrency: "GBP",
  grossWeightKg: 120,
  netWeightKg: 110,
  packageCount: 1,
  packageType: "PK",
  shippingMarks: "TEST-MARK",
  additionalDocuments: [
    { CategoryCode: "N", TypeCode: "935", ID: "INV-2026-LAPTOPS-001", StatusCode: "AC" },
    { CategoryCode: "N", TypeCode: "271", ID: "PL-2026-LAPTOPS-001", StatusCode: "AC" },
  ],
};

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj !== "object") return prefix ? [prefix] : [];
  if (Array.isArray(obj)) {
    return obj.flatMap((v, i) => flattenKeys(v, `${prefix}[${i}]`));
  }
  const rec = obj as Record<string, unknown>;
  const keys: string[] = [];
  for (const [k, v] of Object.entries(rec)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, p));
    } else if (Array.isArray(v)) {
      keys.push(p);
      keys.push(...flattenKeys(v, p));
    } else {
      keys.push(p);
    }
  }
  return keys;
}

function xmlElementPaths(xml: string, rootLocal: string): string[] {
  const lines = xml.split(/\r?\n/);
  const stack: string[] = [];
  const paths: string[] = [];
  for (const line of lines) {
    const open = line.match(/^\s*<([A-Za-z][A-Za-z0-9]*)(?:\s|>)/);
    const selfClose = line.trim().endsWith("/>");
    const close = line.match(/^\s*<\/([A-Za-z][A-Za-z0-9]*)>/);
    if (open && !selfClose) stack.push(open[1]);
    if (close) stack.pop();
    if (open && !selfClose && stack[0] === rootLocal) {
      paths.push(stack.join("/"));
    }
  }
  return [...new Set(paths)].sort();
}

const payload = mapToCDS_H1(laneDecl, [laneItem]);
const xml = renderH1Xml(payload);

const jsonLeafPaths = flattenKeys(payload).filter((p) => !p.endsWith("]"));
const xmlHas = (tag: string) => xml.includes(`<${tag}`);

const mapperOnly = [
  { path: "Declaration.CurrencyExchange.CurrencyTypeCode", tag: "CurrencyExchange" },
  { path: "Declaration.GoodsShipment.TransactionNatureCode", tag: "TransactionNatureCode" },
];

console.log("=== FC-MPUGJ6M8 proxy (lane + GBLON004) — submitted XML not archived ===\n");
console.log("TransactionNatureCode in XML:", xmlHas("TransactionNatureCode"));
console.log("CurrencyExchange in XML:", xmlHas("CurrencyExchange"));
console.log("DeclarationOfficeID in XML:", xmlHas("DeclarationOfficeID"));

console.log("\n=== Mapper JSON present but NOT rendered ===\n");
for (const row of mapperOnly) {
  const val = row.path.split(".").reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], payload as unknown);
  console.log(`  ${row.path} = ${JSON.stringify(val)} → <${row.tag}> in XML: ${xmlHas(row.tag)}`);
}

console.log("\n=== Renderer emits but NOT in mapper JSON ===\n");
console.log("  ValuationAdjustment/AdditionCode 0000:", xml.includes("<ValuationAdjustment>"));
console.log("  Extra DutyTaxFee B00:", (xml.match(/<DutyTaxFee>/g) || []).length, "blocks");

console.log("\n=== 67A GoodsShipment element tree (XML order) ===\n");
const gsBlock = xml.match(/<GoodsShipment>([\s\S]*?)<\/GoodsShipment>/)?.[1] ?? "";
for (const m of gsBlock.matchAll(/^\s*<([A-Za-z][A-Za-z0-9]*)/gm)) {
  console.log(`  ${m[1]}`);
}

console.log("\n=== 68A GovernmentAgencyGoodsItem[1] direct children (XML order) ===\n");
const itemBlock = xml.match(/<GovernmentAgencyGoodsItem>([\s\S]*?)<\/GovernmentAgencyGoodsItem>/)?.[1] ?? "";
for (const m of itemBlock.matchAll(/^\s{6}<([A-Za-z][A-Za-z0-9]*)/gm)) {
  console.log(`  ${m[1]}`);
}

console.log("\n=== WCO Tag 103 mapping (cds_wco_references.ts) ===\n");
console.log("  67A Tag 103 → GoodsShipment/TransactionNatureCode (DE 8/5), NOT CountryCode");
console.log("  68A Tag 103 → GovernmentAgencyGoodsItem/TransactionNatureCode (DE 8/5)");
console.log("  Destination CountryCode → WCOID 465");
console.log("  Origin CountryCode → WCOID 063");
console.log("  GoodsLocation Address CountryCode → WCOID 242");
