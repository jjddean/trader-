import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyseInventoryRejection,
  describeInventoryRejection,
  isGprOnInventoryLinkedRejection,
  INVENTORY_VALIDATION_CODE,
} from "../../convex/lib/cns_inventory_reject";

/**
 * The pre-check failure fixture is the published example from CSP CDS Interface
 * Specification — Customs Declaration API v1.0.3 §7 (Inventory Linking for
 * Imports), which states Declaration/ID (MRN) "will always be blank".
 */
const PRECHECK_FAILURE = `<MetaData xmlns:ns2="urn:wco:datamodel:WCO:RES-DMS:2" xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2" xmlns:ns3="urn:wco:datamodel:WCO:Response_DS:DMS:2">
<WCODataModelVersionCode>3.6</WCODataModelVersionCode>
<WCOTypeName>RES</WCOTypeName>
<ResponsibleAgencyName>CSP</ResponsibleAgencyName>
<ns2:Response>
<ns2:FunctionCode>03</ns2:FunctionCode>
<ns2:FunctionalReferenceID>123CBA</ns2:FunctionalReferenceID>
<ns2:AdditionalInformation>
<ns2:StatementCode>E70</ns2:StatementCode>
<ns2:StatementDescription>Consignment not found on inventory</ns2:StatementDescription>
</ns2:AdditionalInformation>
<ns2:Error>
<ns2:ValidationCode>CDS20001</ns2:ValidationCode>
<ns2:Pointer>
<ns2:DocumentSectionCode>42A</ns2:DocumentSectionCode>
<ns2:TagID>D026</ns2:TagID>
</ns2:Pointer>
</ns2:Error>
<ns2:Declaration>
<ns2:FunctionalReferenceID>ABC123</ns2:FunctionalReferenceID>
<ns2:VersionID>1</ns2:VersionID>
</ns2:Declaration>
</ns2:Response>
</MetaData>`;

/** A genuine CDS rejection: an MRN was issued, so the declaration reached CDS. */
const CDS_REJECTION = `<MetaData xmlns:ns2="urn:wco:datamodel:WCO:RES-DMS:2">
<ns2:Response>
<ns2:FunctionCode>03</ns2:FunctionCode>
<ns2:FunctionalReferenceID>ABC123</ns2:FunctionalReferenceID>
<ns2:Error>
<ns2:ValidationCode>CDS12073</ns2:ValidationCode>
</ns2:Error>
<ns2:Declaration>
<ns2:ID>19GBANTQHMM69FGVR7</ns2:ID>
<ns2:FunctionalReferenceID>ABC123</ns2:FunctionalReferenceID>
</ns2:Declaration>
</ns2:Response>
</MetaData>`;

const PRECHECK_HEADERS = {
  "X-Badge-ID": "RKA",
  "X-CSP-ID": "RKA-1234567890123",
  "X-Notification-Type": "DMS",
};

describe("analyseInventoryRejection — pre-check failure", () => {
  const result = analyseInventoryRejection(PRECHECK_FAILURE, PRECHECK_HEADERS);

  it("identifies it as an inventory pre-check failure", () => {
    assert.equal(result.isInventoryPreCheck, true);
  });

  it("reports CDS20001", () => {
    assert.equal(result.validationCode, INVENTORY_VALIDATION_CODE);
  });

  it("extracts the IRC code and description for the operator", () => {
    assert.equal(result.ircCode, "E70");
    assert.equal(result.ircDescription, "Consignment not found on inventory");
  });

  it("records the blank MRN — the declaration never reached CDS", () => {
    assert.equal(result.mrnBlank, true);
  });

  it("carries the X-CSP-ID from the initial handshake", () => {
    assert.equal(result.cspId, "RKA-1234567890123");
  });

  it("recovers the LRN, which is the only permanent correlation key here", () => {
    assert.equal(result.functionalReferenceId, "ABC123");
  });

  it("prefers the declaration LRN over the response reference UUID", () => {
    const result = analyseInventoryRejection(
      PRECHECK_FAILURE.replace("123CBA", "462c22fa8751436487b3e506a402dca4"),
      PRECHECK_HEADERS,
    );
    assert.equal(result.functionalReferenceId, "ABC123");
  });
});

describe("analyseInventoryRejection — genuine CDS rejection", () => {
  const result = analyseInventoryRejection(CDS_REJECTION, {
    "X-Notification-Type": "DMS",
    ConversationID: "00001101-0000-1000-8000-00805f9b34fb",
  });

  it("is NOT treated as an inventory pre-check failure", () => {
    assert.equal(result.isInventoryPreCheck, false);
  });

  it("does not report a blank MRN", () => {
    assert.equal(result.mrnBlank, false);
  });
});

describe("analyseInventoryRejection — boundary cases", () => {
  it("does not claim a pre-check failure when CDS20001 arrives WITH an MRN", () => {
    // Declaration API v1.0.3 notes the E0-equivalent DMSRCV also carries
    // CDS20001. With an MRN present the declaration did reach CDS, so this must
    // not be reported as a pre-check rejection.
    const withMrn = PRECHECK_FAILURE.replace(
      "<ns2:VersionID>1</ns2:VersionID>",
      "<ns2:ID>19GBANTQHMM69FGVR7</ns2:ID><ns2:VersionID>1</ns2:VersionID>",
    );
    assert.equal(analyseInventoryRejection(withMrn, PRECHECK_HEADERS).isInventoryPreCheck, false);
  });

  it("does not claim a pre-check failure on a blank MRN alone", () => {
    const otherCode = PRECHECK_FAILURE.replace("CDS20001", "CDS12056");
    assert.equal(analyseInventoryRejection(otherCode, PRECHECK_HEADERS).isInventoryPreCheck, false);
  });

  it("handles an empty body without throwing", () => {
    const result = analyseInventoryRejection("", {});
    assert.equal(result.isInventoryPreCheck, false);
    assert.equal(result.validationCode, "");
  });
});

describe("isGprOnInventoryLinkedRejection", () => {
  it("detects CDS12015", () => {
    assert.equal(
      isGprOnInventoryLinkedRejection("<Error><ValidationCode>CDS12015</ValidationCode></Error>"),
      true,
    );
  });

  it("is false for an inventory pre-check failure", () => {
    assert.equal(isGprOnInventoryLinkedRejection(PRECHECK_FAILURE), false);
  });
});

describe("describeInventoryRejection", () => {
  it("states plainly that CDS was never reached", () => {
    const summary = describeInventoryRejection(
      analyseInventoryRejection(PRECHECK_FAILURE, PRECHECK_HEADERS),
      "LGP100DPS00100",
    );
    assert.match(summary, /CDS20001/);
    assert.match(summary, /LGP100DPS00100/);
    assert.match(summary, /E70/);
    assert.match(summary, /did not reach CDS/);
  });
});
