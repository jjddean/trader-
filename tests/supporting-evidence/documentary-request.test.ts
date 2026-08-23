/**
 * DMSDOC documentary-check parsing and evidence matching.
 *
 * Structure per the WCO DEC-DMS reference mirrored at
 * `convex/lib/cds_wco_references.ts`, which states for StatementTypeCode:
 *
 *   "DMSDOC: 'ACA' (document type to be presented for document control)"
 *
 * so ACA marks the block and the request itself is in StatementCode /
 * StatementDescription.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCUMENTARY_REQUEST_STATEMENT_TYPE,
  matchRequestedEvidence,
  parseDocumentaryRequest,
  resolveDocumentType,
  type DeclarationSupportingDocument,
} from "../../src/lib/hmrc-supporting-evidence";

/** Header-level request with a Pointer to goods item 1. */
const HEADER_DMSDOC = `<?xml version="1.0" encoding="UTF-8"?>
<md:MetaData xmlns:md="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <md:WCODataModelVersionCode>3.6</md:WCODataModelVersionCode>
  <resp:Response xmlns:resp="urn:wco:datamodel:WCO:RES-DMS:2">
    <resp:FunctionCode>10</resp:FunctionCode>
    <resp:Declaration>
      <resp:ID>26GB664W3BLIFZFAR4</resp:ID>
      <resp:AdditionalInformation>
        <resp:StatementCode>N935</resp:StatementCode>
        <resp:StatementDescription>Commercial invoice</resp:StatementDescription>
        <resp:StatementTypeCode>ACA</resp:StatementTypeCode>
        <resp:Pointer>
          <resp:SequenceNumeric>1</resp:SequenceNumeric>
          <resp:DocumentSectionCode>42A</resp:DocumentSectionCode>
        </resp:Pointer>
      </resp:AdditionalInformation>
      <resp:AdditionalInformation>
        <resp:StatementCode>U059</resp:StatementCode>
        <resp:StatementDescription>Certificate of origin</resp:StatementDescription>
        <resp:StatementTypeCode>ACA</resp:StatementTypeCode>
      </resp:AdditionalInformation>
    </resp:Declaration>
  </resp:Response>
</md:MetaData>`;

/** Item-level request, plus an unrelated AFB block that must be ignored. */
const ITEM_DMSDOC = `<Response>
  <Declaration>
    <ID>26GB664W3BLIFZFAR4</ID>
    <AdditionalInformation>
      <StatementDescription>Customs position motivation</StatementDescription>
      <StatementTypeCode>AFB</StatementTypeCode>
    </AdditionalInformation>
    <GoodsShipment>
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>2</SequenceNumeric>
        <AdditionalInformation>
          <StatementCode>C400</StatementCode>
          <StatementDescription>CITES permit</StatementDescription>
          <StatementTypeCode>ACA</StatementTypeCode>
        </AdditionalInformation>
      </GovernmentAgencyGoodsItem>
    </GoodsShipment>
  </Declaration>
</Response>`;

describe("parseDocumentaryRequest", () => {
  it("uses ACA as the marker, not as the requested document type", () => {
    const parsed = parseDocumentaryRequest(HEADER_DMSDOC, "26GB664W3BLIFZFAR4");
    assert.equal(DOCUMENTARY_REQUEST_STATEMENT_TYPE, "ACA");
    // The document HMRC wants is N935 / "Commercial invoice" — never "ACA".
    assert.equal(parsed.items[0].statementCode, "N935");
    assert.equal(parsed.items[0].description, "Commercial invoice");
    for (const item of parsed.items) {
      assert.notEqual(item.statementCode, "ACA");
      assert.notEqual(item.description, "ACA");
    }
  });

  it("reads every requested document from a header-level check", () => {
    const parsed = parseDocumentaryRequest(HEADER_DMSDOC);
    assert.equal(parsed.items.length, 2);
    assert.deepEqual(
      parsed.items.map((i) => i.statementCode),
      ["N935", "U059"],
    );
  });

  it("keeps the Pointer so a request can be tied to its goods item", () => {
    const parsed = parseDocumentaryRequest(HEADER_DMSDOC);
    assert.equal(parsed.items[0].goodsItemNumber, 1);
    assert.equal(parsed.items[0].pointer?.documentSectionCode, "42A");
    assert.equal(parsed.items[0].level, "header");
  });

  it("reads item-level requests and takes the item's own sequence number", () => {
    const parsed = parseDocumentaryRequest(ITEM_DMSDOC);
    const cites = parsed.items.find((i) => i.statementCode === "C400");
    assert.ok(cites);
    assert.equal(cites.goodsItemNumber, 2);
    assert.equal(cites.level, "item");
  });

  it("ignores AdditionalInformation blocks that are not documentary requests", () => {
    // AFB is customs position motivation on DMSINV/DMSROG — not a document ask.
    const parsed = parseDocumentaryRequest(ITEM_DMSDOC);
    assert.equal(parsed.items.length, 1);
    assert.ok(!parsed.items.some((i) => i.description?.includes("motivation")));
  });

  it("does not double-count an item block as a header block", () => {
    const parsed = parseDocumentaryRequest(ITEM_DMSDOC);
    assert.equal(parsed.items.filter((i) => i.statementCode === "C400").length, 1);
  });

  it("returns no items for a payload with no ACA block", () => {
    const parsed = parseDocumentaryRequest("<Response><Declaration/></Response>");
    assert.deepEqual(parsed.items, []);
  });

  it("surfaces a request that carries a description but no code", () => {
    const xml = `<Declaration><AdditionalInformation>
      <StatementDescription>Proof of preferential origin</StatementDescription>
      <StatementTypeCode>ACA</StatementTypeCode>
    </AdditionalInformation></Declaration>`;
    const parsed = parseDocumentaryRequest(xml);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].statementCode, undefined);
    assert.equal(parsed.items[0].description, "Proof of preferential origin");
  });

  it("carries the MRN through", () => {
    assert.equal(parseDocumentaryRequest(HEADER_DMSDOC, "26GB664W3BLIFZFAR4").mrn, "26GB664W3BLIFZFAR4");
  });
});

describe("matchRequestedEvidence", () => {
  const supporting: DeclarationSupportingDocument[] = [
    { code: "N935", name: "Commercial invoice", goodsItemNumber: 1, linkedDocumentId: "doc_1", linkedFileName: "invoice-4482.pdf" },
    { code: "U059", name: "Certificate of origin" },
  ];

  it("matches a request to the DE 2/3 record with the same code", () => {
    const [first] = matchRequestedEvidence(
      [{ statementCode: "U059", level: "header" }],
      supporting,
    );
    assert.equal(first.matchedBy, "document_code");
    assert.equal(first.supportingDocument?.name, "Certificate of origin");
  });

  it("prefers the record on the same goods item", () => {
    const twoItems: DeclarationSupportingDocument[] = [
      { code: "N935", goodsItemNumber: 1, linkedDocumentId: "doc_1" },
      { code: "N935", goodsItemNumber: 2, linkedDocumentId: "doc_2" },
    ];
    const [match] = matchRequestedEvidence(
      [{ statementCode: "N935", goodsItemNumber: 2, level: "header" }],
      twoItems,
    );
    assert.equal(match.matchedBy, "document_code_and_item");
    assert.equal(match.documentId, "doc_2");
  });

  it("surfaces the linked file when one is held", () => {
    const [match] = matchRequestedEvidence(
      [{ statementCode: "N935", goodsItemNumber: 1, level: "header" }],
      supporting,
    );
    assert.equal(match.fileName, "invoice-4482.pdf");
    assert.equal(match.documentId, "doc_1");
  });

  it("normalises code punctuation and case before comparing", () => {
    const [match] = matchRequestedEvidence(
      [{ statementCode: " n-935 ", goodsItemNumber: 1, level: "header" }],
      supporting,
    );
    assert.equal(match.supportingDocument?.code, "N935");
  });

  it("refuses to match when the code is ambiguous", () => {
    // Two records, same code, no goods item to separate them: guessing here
    // would send HMRC the wrong file under the right heading.
    const ambiguous: DeclarationSupportingDocument[] = [
      { code: "N935", linkedDocumentId: "doc_1" },
      { code: "N935", linkedDocumentId: "doc_2" },
    ];
    const [match] = matchRequestedEvidence([{ statementCode: "N935", level: "header" }], ambiguous);
    assert.equal(match.matchedBy, "unmatched");
    assert.equal(match.documentId, undefined);
  });

  it("never matches on filename", () => {
    const byFilenameOnly: DeclarationSupportingDocument[] = [
      { linkedDocumentId: "doc_9", linkedFileName: "commercial invoice.pdf" },
    ];
    const [match] = matchRequestedEvidence(
      [{ description: "Commercial invoice", level: "header" }],
      byFilenameOnly,
    );
    assert.equal(match.matchedBy, "unmatched");
  });

  it("falls back to an exact description match, and only an exact one", () => {
    const [exact] = matchRequestedEvidence(
      [{ description: "Certificate of origin", level: "header" }],
      supporting,
    );
    assert.equal(exact.matchedBy, "description");

    const [partial] = matchRequestedEvidence(
      [{ description: "Certificate", level: "header" }],
      supporting,
    );
    assert.equal(partial.matchedBy, "unmatched");
  });

  it("marks an unmatched request so the user is asked to attach the file", () => {
    const [match] = matchRequestedEvidence(
      [{ statementCode: "C400", description: "CITES permit", level: "item" }],
      supporting,
    );
    assert.equal(match.matchedBy, "unmatched");
    assert.equal(match.documentId, undefined);
    // The request itself survives so the UI can still show what HMRC wants.
    assert.equal(match.request.description, "CITES permit");
  });

  it("returns one result per request, in order", () => {
    const requests = parseDocumentaryRequest(HEADER_DMSDOC).items;
    const matched = matchRequestedEvidence(requests, supporting);
    assert.equal(matched.length, requests.length);
    assert.deepEqual(
      matched.map((m) => m.request.statementCode),
      ["N935", "U059"],
    );
  });
});

describe("resolveDocumentType", () => {
  it("never defaults to invoice", () => {
    assert.equal(resolveDocumentType({}), undefined);
    assert.notEqual(resolveDocumentType({}), "invoice");
  });

  it("uses the user's explicit choice first", () => {
    assert.equal(resolveDocumentType({ selected: "Licence", requestDescription: "Invoice" }), "Licence");
  });

  it("echoes HMRC's own description when nothing was chosen", () => {
    // HMRC publishes no value list, so its own wording is the safest value.
    assert.equal(resolveDocumentType({ requestDescription: "Certificate of origin" }), "Certificate of origin");
  });

  it("omits the element rather than inventing a value", () => {
    assert.equal(resolveDocumentType({ selected: "   ", requestDescription: "  " }), undefined);
  });
});
