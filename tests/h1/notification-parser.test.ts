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
