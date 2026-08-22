import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { XMLParser } from "fast-xml-parser";

import { mapToCDS_H1 } from "../../src/lib/wco-mapper";
import { renderH1Xml } from "../../src/lib/h1-xml-renderer";
import { mapToCDS_B1 } from "../../src/lib/b1-mapper";
import { renderB1Xml } from "../../src/lib/b1-xml-renderer";
import { mapToCDS_C1 } from "../../src/lib/c1-mapper";
import { renderC1Xml } from "../../src/lib/c1-xml-renderer";
import { mapToCDS_I1 } from "../../src/lib/i1-mapper";
import { renderI1Xml } from "../../src/lib/i1-xml-renderer";

/**
 * Structural conformance for every declaration category we render.
 *
 * Full XSD validation is not possible in-repo: WCO_DEC_2_DMS.xsd imports the
 * Declaration_DS datatype schemas, which HMRC ships separately and we do not
 * mirror. What IS checkable — and what actually bites in CDS — is structure:
 * every element must be a declared child of its parent, and siblings must
 * appear in the order the XSD sequence declares. A misplaced element is the
 * failure mode behind the BAD_REQUEST/CDS12073 class of rejection.
 *
 * This walks the whole document rather than asserting named paths, so a new
 * element added to any renderer is checked automatically.
 */

const XSD_PATH = path.join(process.cwd(), "docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd");
const CONTAINER_TAGS = new Set(["xs:complexType", "xs:sequence", "xs:choice", "xs:all"]);

type XsdNode = Record<string, unknown>;

/** Ordered child element names for every path under Declaration, from the XSD. */
function buildAllowedChildren(): Map<string, string[]> {
  const xml = fs.readFileSync(XSD_PATH, "utf8");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: true,
  }).parse(xml);

  // preserveOrder gives arrays of single-key objects, which keeps sibling order.
  function childElements(node: unknown): XsdNode[] {
    const out: XsdNode[] = [];
    const visit = (entries: unknown) => {
      if (!Array.isArray(entries)) return;
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        for (const [tag, value] of Object.entries(entry as XsdNode)) {
          if (tag === ":@") continue;
          const attrs = (entry as XsdNode)[":@"] as Record<string, string> | undefined;
          if (tag === "xs:element" && attrs?.["@_name"]) {
            out.push(entry as XsdNode);
          } else if (CONTAINER_TAGS.has(tag)) {
            visit(value);
          }
        }
      }
    };
    visit(node);
    return out;
  }

  const nameOf = (node: XsdNode): string =>
    ((node[":@"] as Record<string, string>)?.["@_name"]) ?? "";
  const bodyOf = (node: XsdNode): unknown => node["xs:element"];

  const allowed = new Map<string, string[]>();
  const index = (node: unknown, atPath: string) => {
    const kids = childElements(node);
    allowed.set(atPath, kids.map(nameOf));
    for (const kid of kids) index(bodyOf(kid), `${atPath}/${nameOf(kid)}`);
  };

  // Locate <xs:complexType name="Declaration">.
  const schema = (parsed as XsdNode[]).find((e) => "xs:schema" in e) as XsdNode | undefined;
  const schemaBody = (schema?.["xs:schema"] ?? []) as XsdNode[];
  const declarationType = schemaBody.find(
    (e) =>
      "xs:complexType" in e
      && (e[":@"] as Record<string, string> | undefined)?.["@_name"] === "Declaration",
  );
  assert.ok(declarationType, "Declaration complexType not found in WCO_DEC_2_DMS.xsd");
  index(declarationType["xs:complexType"], "Declaration");
  return allowed;
}

const ALLOWED = buildAllowedChildren();

/** Walks rendered XML, returning every structural violation found. */
function structuralViolations(xml: string): string[] {
  const parsed = new XMLParser({ ignoreAttributes: true, preserveOrder: true }).parse(xml);
  const problems: string[] = [];

  const findDeclaration = (nodes: unknown): unknown => {
    if (!Array.isArray(nodes)) return undefined;
    for (const node of nodes) {
      for (const [tag, value] of Object.entries(node as XsdNode)) {
        if (tag === "Declaration") return value;
        const found = findDeclaration(value);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };

  const walk = (nodes: unknown, atPath: string) => {
    const order = ALLOWED.get(atPath);
    if (!order || !Array.isArray(nodes)) return;
    let highWater = -1;
    for (const node of nodes) {
      for (const [tag, value] of Object.entries(node as XsdNode)) {
        if (tag === "#text" || tag === ":@") continue;
        const position = order.indexOf(tag);
        if (position === -1) {
          problems.push(`${atPath}: <${tag}> is not a declared child`);
          continue;
        }
        if (position < highWater) {
          problems.push(
            `${atPath}: <${tag}> appears after <${order[highWater]}>, out of XSD sequence order`,
          );
        }
        highWater = Math.max(highWater, position);
        walk(value, `${atPath}/${tag}`);
      }
    }
  };

  const declaration = findDeclaration(parsed);
  assert.ok(declaration, "no <Declaration> element in rendered XML");
  walk(declaration, "Declaration");
  return problems;
}

const h1Declaration = {
  _id: "kn7d36t02m9wn70e4hzzdfj64h88djpk",
  eori: "GB553202734852",
  importerEori: "GB553202734852",
  lrn: "FC-MQ8IDIYS",
  declarationType: "H1",
  route: "import",
  destinationCountry: "GB",
  dispatchCountry: "DE",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  invoiceCurrency: "GBP",
  invoiceTotal: 5000,
  incoterms: "CIF",
  incotermLocation: "Felixstowe",
  transactionNatureCode: "11",
  transportMode: "1",
  transportIdType: "11",
  transportId: "CSCL GLOBE",
  exporterName: "Acme Export GmbH",
  exporterCity: "Hamburg",
  exporterLine: "1 Hafenstrasse",
  exporterPostcode: "20095",
};

const h1Items = [
  {
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
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    packageCount: 1,
    packageType: "PK",
    shippingMarks: "N/A",
    additionalDocuments: [
      { CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: "TEST-INV-2026-0428-001" },
    ],
  },
];

const b1Declaration = {
  _id: "b1exportdeclarationrecordid000001",
  route: "export",
  declarationCategory: "B1",
  declarationType: "A",
  lrn: "FC-B1TEST01",
  eori: "GB553202734852",
  exporterEori: "GB553202734852",
  destinationCountry: "US",
  dispatchCountry: "GB",
  customsOfficeOfExit: "GB000060",
  presentationOffice: "GB000060",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  transportId: "MAERSK ESSEX",
  transportIdType: "11",
  borderTransportNationality: "GB",
  inlandTransportMode: "3",
  transactionNatureCode: "11",
  invoiceCurrency: "GBP",
  invoiceTotal: 12500,
  consigneeName: "Acme Inc",
  consigneeCity: "Newark",
  consigneeLine: "200 Dock Street",
  consigneePostcode: "07102",
  consigneeCountry: "US",
  carrierName: "Maersk Line",
  carrierEori: "GB111222333444",
  countriesOfRouting: ["FR", "ES"],
  sealNumber: "SEAL-88213",
  containerId: "MSKU1234567",
  authorisationHolderEori: "GB553202734852",
  authorisationCategoryCode: "CSE",
  transportChargesMethodOfPayment: "H",
  exchangeRate: "1.27",
};

const b1Items = [
  {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    originCountry: "GB",
    procedureCode: "1000",
    additionalProcedureCode: "000",
    valueAmount: 12500,
    statisticalValue: 12500,
    grossWeightKg: 120,
    netWeightKg: 110,
    packageCount: 4,
    packageType: "PK",
    shippingMarks: "ACME-001",
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: "INV-1" }],
  },
];

const i1Declaration = {
  _id: "i1importdeclarationrecordid000001",
  route: "import",
  declarationCategory: "I1",
  declarationType: "C",
  lrn: "FC-I1TEST01",
  eori: "GB553202734852",
  importerEori: "GB553202734852",
  authorisationHolderEori: "GB553202734852",
  authorisationCategoryCode: "SDE",
  dispatchCountry: "DE",
  destinationCountry: "GB",
  exporterName: "Acme Export GmbH",
  exporterCity: "Hamburg",
  exporterLine: "1 Hafenstrasse",
  exporterPostcode: "20095",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  transportId: "CSCL GLOBE",
  transportIdType: "11",
  invoiceCurrency: "GBP",
  invoiceTotal: 5000,
  presentationOffice: "GB000060",
};

const i1Items = [
  {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    originCountry: "DE",
    procedureCode: "4000",
    additionalProcedureCode: "000",
    valueAmount: 5000,
    grossWeightKg: 120,
    netWeightKg: 110,
    packageCount: 1,
    packageType: "PK",
    shippingMarks: "ACME-001",
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    additionalDocuments: [
      { CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: "INV-2026-001" },
    ],
  },
];

describe("WCO XSD structural conformance", () => {
  it("indexes the Declaration element tree from the XSD", () => {
    assert.ok(ALLOWED.size > 400, `expected the full element tree, indexed ${ALLOWED.size} paths`);
    assert.deepEqual(ALLOWED.get("Declaration")?.slice(0, 3), [
      "AcceptanceDateTime",
      "FunctionCode",
      "FunctionalReferenceID",
    ]);
  });

  it("H1 renders only declared elements, in sequence order", () => {
    const xml = renderH1Xml(mapToCDS_H1(h1Declaration as never, h1Items as never));
    assert.deepEqual(structuralViolations(xml), []);
  });

  it("B1 renders only declared elements, in sequence order", () => {
    const xml = renderB1Xml(mapToCDS_B1(b1Declaration as never, b1Items as never));
    assert.deepEqual(structuralViolations(xml), []);
  });

  it("C1 renders only declared elements, in sequence order", () => {
    const c1Declaration = {
      ...b1Declaration,
      declarationCategory: "C1",
      declarationType: "C",
      authorisationHolderEori: "GB553202734852",
      authorisationCategoryCode: "SDE",
      transactionNatureCode: undefined,
      exchangeRate: undefined,
      inlandTransportMode: undefined,
      borderTransportNationality: undefined,
    };
    const xml = renderC1Xml(mapToCDS_C1(c1Declaration as never, b1Items as never));
    assert.deepEqual(structuralViolations(xml), []);
  });

  it("I1 renders only declared elements, in sequence order", () => {
    const xml = renderI1Xml(mapToCDS_I1(i1Declaration as never, i1Items as never));
    assert.deepEqual(structuralViolations(xml), []);
  });

  // Guard the guard: a deliberately misplaced element must be caught.
  it("detects an out-of-order element", () => {
    const xml = renderB1Xml(mapToCDS_B1(b1Declaration as never, b1Items as never)).replace(
      /(<Declarant>[\s\S]*?<\/Declarant>)([\s\S]*?)(<ExitOffice>[\s\S]*?<\/ExitOffice>)/,
      "$3$2$1",
    );
    const problems = structuralViolations(xml);
    assert.ok(problems.length > 0, "swapped Declarant/ExitOffice was not detected");
    assert.ok(problems.some((p) => p.includes("out of XSD sequence order")));
  });

  it("detects an undeclared element", () => {
    const xml = renderB1Xml(mapToCDS_B1(b1Declaration as never, b1Items as never)).replace(
      "<Declarant>",
      "<NotAWcoElement>x</NotAWcoElement><Declarant>",
    );
    const problems = structuralViolations(xml);
    assert.ok(problems.some((p) => p.includes("<NotAWcoElement> is not a declared child")));
  });
});
