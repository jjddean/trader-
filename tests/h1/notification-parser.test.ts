import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseHmrcNotification } from "../../src/lib/hmrc-notification-parser";

describe("HMRC DMS notification parser", () => {
  it("extracts DMSACC and MRN from accepted notification XML", () => {
    const parsed = parseHmrcNotification(`
      <Notification>
        <NameCode>DMSACC</NameCode>
        <Declaration>
          <ID>26GB1234567890ABCD</ID>
        </Declaration>
      </Notification>
    `);

    assert.equal(parsed.notificationType, "DMSACC");
    assert.equal(parsed.mrn, "26GB1234567890ABCD");
    assert.deepEqual(parsed.errorCodes, []);
    assert.deepEqual(parsed.fieldErrors, []);
  });

  it("maps NameCode 4 with FunctionCode 13 to DMSTAX", () => {
    const parsed = parseHmrcNotification(`
      <Response>
        <FunctionCode>13</FunctionCode>
        <Status><NameCode>4</NameCode></Status>
        <Declaration><ID>26GB63M1I0RQFCVAR4</ID></Declaration>
      </Response>
    `);
    assert.equal(parsed.notificationType, "DMSTAX");
  });

  it("maps FunctionCode 13 and NameCode 67 to DMSTAX (tax calculation)", () => {
    const parsed = parseHmrcNotification(`
      <Response>
        <FunctionCode>13</FunctionCode>
        <Status><NameCode>67</NameCode></Status>
        <Declaration>
          <ID>26GB63M1I0RQFCVAR4</ID>
          <FunctionalReferenceID>FC-MPYAJ7RN</FunctionalReferenceID>
        </Declaration>
      </Response>
    `);

    assert.equal(parsed.notificationType, "DMSTAX");
    assert.equal(parsed.mrn, "26GB63M1I0RQFCVAR4");
    assert.deepEqual(parsed.errorCodes, []);
  });

  it("extracts CDS13000 from DMSACC smart Error (ValidationCode)", () => {
    const parsed = parseHmrcNotification(`
      <Response>
        <FunctionCode>01</FunctionCode>
        <Error>
          <Description>Value per kilo appears too low for this commodity</Description>
          <ValidationCode>CDS13000</ValidationCode>
          <Pointer><DocumentSectionCode>68A</DocumentSectionCode><SequenceNumeric>1</SequenceNumeric></Pointer>
        </Error>
        <Declaration><ID>26GB63M1I0RQFCVAR4</ID></Declaration>
      </Response>
    `);

    assert.equal(parsed.notificationType, "DMSACC");
    assert.deepEqual(parsed.errorCodes, ["CDS13000"]);
    assert.equal(parsed.fieldErrors[0]?.reason, "Value per kilo appears too low for this commodity");
  });

  it("maps FunctionCode 11 to DMSCLE", () => {
    const parsed = parseHmrcNotification(`
      <Response>
        <FunctionCode>11</FunctionCode>
        <Declaration>
          <ID>26GB63M1I0RQFCVAR4</ID>
          <FunctionalReferenceID>FC-MPYAJ7RN</FunctionalReferenceID>
        </Declaration>
      </Response>
    `);
    assert.equal(parsed.notificationType, "DMSCLE");
    assert.equal(parsed.mrn, "26GB63M1I0RQFCVAR4");
  });

  it("maps FunctionCode 04 to DMSROG", () => {
    const parsed = parseHmrcNotification(`<Response><FunctionCode>04</FunctionCode></Response>`);
    assert.equal(parsed.notificationType, "DMSROG");
  });

  it("maps FunctionCode 07 to DMSCTL", () => {
    const parsed = parseHmrcNotification(`<Response><FunctionCode>07</FunctionCode></Response>`);
    assert.equal(parsed.notificationType, "DMSCTL");
  });

  it("maps FunctionCode 02 to DMSINV", () => {
    const parsed = parseHmrcNotification(`
      <Response>
        <FunctionCode>02</FunctionCode>
        <FunctionalError>
          <ErrorCode>CDS10001</ErrorCode>
          <ErrorReason>Mandatory data element missing</ErrorReason>
        </FunctionalError>
      </Response>
    `);
    assert.equal(parsed.notificationType, "DMSINV");
    assert.deepEqual(parsed.errorCodes, ["CDS10001"]);
  });

  it("maps FunctionCode 08 to DMSRES", () => {
    const parsed = parseHmrcNotification(`<Response><FunctionCode>08</FunctionCode></Response>`);
    assert.equal(parsed.notificationType, "DMSRES");
  });

  it("extracts DMSREJ field-level errors from FunctionalError blocks", () => {
    const parsed = parseHmrcNotification(`
      <Notification>
        <NameCode>DMSREJ</NameCode>
        <Declaration>
          <ID>26GB1234567890ABCD</ID>
        </Declaration>
        <FunctionalError>
          <ErrorPointer>/Declaration/GoodsShipment/GovernmentAgencyGoodsItem/Commodity/Classification/ID</ErrorPointer>
          <ErrorCode>CDS12050</ErrorCode>
          <ErrorReason>Commodity code is not valid for the declared procedure.</ErrorReason>
        </FunctionalError>
      </Notification>
    `);

    assert.equal(parsed.notificationType, "DMSREJ");
    assert.equal(parsed.mrn, "26GB1234567890ABCD");
    assert.deepEqual(parsed.errorCodes, ["CDS12050"]);
    assert.deepEqual(parsed.fieldErrors, [
      {
        field: "/Declaration/GoodsShipment/GovernmentAgencyGoodsItem/Commodity/Classification/ID",
        code: "CDS12050",
        reason: "Commodity code is not valid for the declared procedure.",
      },
    ]);
  });
});
