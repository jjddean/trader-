import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { statusAfterNotification } from "../../convex/lib/notification_status";
import {
  isCancellationRejected,
  isInvalidationAccepted,
} from "../../convex/lib/notification_dms_context";

/**
 * Real TDR rejection, 2026-08-15: a cancellation refused with CDS12015 at
 * 42A/D014 — "declaration not in permissible state for amend/cancel"
 * (docs/hmrc/ACTIVE/tdr/errors-handled.md). The request was refused; the
 * declaration itself is untouched and HMRC still holds it.
 */
const CANCEL_REJECT_PAYLOAD = `<_2_1:Response>
  <_2_1:FunctionCode>03</_2_1:FunctionCode>
  <_2_1:Error>
    <_2_1:ValidationCode>CDS12015</_2_1:ValidationCode>
    <_2_1:Pointer>
      <_2_1:DocumentSectionCode>42A</_2_1:DocumentSectionCode>
      <_2_1:TagID>D014</_2_1:TagID>
    </_2_1:Pointer>
  </_2_1:Error>
  <_2_1:Declaration>
    <_2_1:FunctionalReferenceID>CX-jd7abc123def456</_2_1:FunctionalReferenceID>
    <_2_1:ID>26GB905V4M0SPHIAR0</_2_1:ID>
  </_2_1:Declaration>
</_2_1:Response>`;

const base = {
  notificationType: "DMSREJ",
  hasResolvedMrn: true,
  isAmendmentRejected: false,
  isAmendmentAccepted: false,
  isInvalidationAccepted: false,
};

describe("rejected cancellation", () => {
  it("recognises a DMSREJ carrying a cancel LRN", () => {
    assert.equal(
      isCancellationRejected({
        notificationType: "DMSREJ",
        rawPayload: CANCEL_REJECT_PAYLOAD,
      }),
      true,
    );
  });

  // Before the fix this fell through and became "Rejected" — wrong, and rank 100,
  // so no later notification could ever correct it.
  it("does not mark the declaration Rejected", () => {
    const status = statusAfterNotification({
      ...base,
      currentStatus: "Cancellation Requested",
      isCancellationRejected: true,
    });
    assert.notEqual(status, "Rejected");
    assert.equal(status, "Accepted");
  });

  it("leaves any other status untouched", () => {
    for (const current of ["Accepted", "Cleared", "Amended"]) {
      assert.equal(
        statusAfterNotification({ ...base, currentStatus: current, isCancellationRejected: true }),
        current,
      );
    }
  });

  // A genuine declaration rejection must still land.
  it("still rejects the declaration when the DMSREJ is not a cancellation", () => {
    assert.equal(
      statusAfterNotification({
        ...base,
        currentStatus: "Processing",
        isCancellationRejected: false,
      }),
      "Rejected",
    );
  });

  it("treats a DMSREJ without a cancel LRN as a declaration rejection", () => {
    assert.equal(
      isCancellationRejected({
        notificationType: "DMSREJ",
        rawPayload: "<Response><FunctionCode>03</FunctionCode></Response>",
      }),
      false,
    );
  });

  /**
   * The real payload shape: HMRC echoes the ORIGINAL declaration reference
   * (FC-…), never the CX- cancel LRN. Payload inspection alone cannot tell a
   * refused cancellation from a rejected declaration.
   */
  const REAL_PAYLOAD = `<Response>
      <FunctionCode>03</FunctionCode>
      <Error><ValidationCode>CDS12015</ValidationCode>
        <Pointer><DocumentSectionCode>42A</DocumentSectionCode><TagID>D014</TagID></Pointer>
      </Error>
      <Declaration>
        <FunctionalReferenceID>FC-MSUUCU2Y</FunctionalReferenceID>
        <ID>26GB905V4M0SPHIAR0</ID>
      </Declaration>
    </Response>`;

  it("payload inspection alone cannot detect it", () => {
    assert.equal(
      isCancellationRejected({ notificationType: "DMSREJ", rawPayload: REAL_PAYLOAD }),
      false,
    );
  });

  // HMRC issues a distinct conversationId per request, so the submissions row
  // for that conversationId names the operation. Verified in production data.
  it("detects it from the originating operation on the real payload", () => {
    assert.equal(
      isCancellationRejected({
        notificationType: "DMSREJ",
        rawPayload: REAL_PAYLOAD,
        originatingOperation: "cancel",
      }),
      true,
    );
  });

  it("a DMSREJ answering a submit is a real declaration rejection", () => {
    assert.equal(
      isCancellationRejected({
        notificationType: "DMSREJ",
        rawPayload: REAL_PAYLOAD,
        originatingOperation: "submit",
      }),
      false,
    );
  });

  it("a DMSREJ answering an amend is not a cancellation", () => {
    assert.equal(
      isCancellationRejected({
        notificationType: "DMSREJ",
        rawPayload: REAL_PAYLOAD,
        originatingOperation: "amend",
      }),
      false,
    );
  });

  it("end to end: a refused cancellation leaves the declaration usable", () => {
    const cancelRejected = isCancellationRejected({
      notificationType: "DMSREJ",
      rawPayload: REAL_PAYLOAD,
      originatingOperation: "cancel",
    });
    const status = statusAfterNotification({
      ...base,
      currentStatus: "Cancellation Requested",
      isCancellationRejected: cancelRejected,
    });
    assert.equal(status, "Accepted");
  });
});

describe("accepted cancellation (FC 02 DMSINV, CNS route)", () => {
  // Declaration B, 2026-08-15 23:04:14. Cancel accepted. The CNS route sends the
  // ORIGINAL create LRN (FC-…), so no CX- appears and payload inspection alone
  // read this as a validation failure — shown to the operator in red.
  const ACCEPTED_CANCEL = `<Response>
      <FunctionCode>02</FunctionCode>
      <Declaration>
        <FunctionalReferenceID>FC-MSUX9NFX</FunctionalReferenceID>
        <ID>26GB908RYZ3SRUKAR0</ID>
      </Declaration>
    </Response>`;

  it("payload alone misses it on the CNS route", () => {
    assert.equal(
      isInvalidationAccepted({ notificationType: "DMSINV", rawPayload: ACCEPTED_CANCEL }),
      false,
    );
  });

  it("is recognised once the originating operation is known", () => {
    assert.equal(
      isInvalidationAccepted({
        notificationType: "DMSINV",
        rawPayload: ACCEPTED_CANCEL,
        originatingOperation: "cancel",
      }),
      true,
    );
  });

  it("a clean DMSINV answering a submit is not a cancellation acceptance", () => {
    assert.equal(
      isInvalidationAccepted({
        notificationType: "DMSINV",
        rawPayload: ACCEPTED_CANCEL,
        originatingOperation: "submit",
      }),
      false,
    );
  });

  it("validation errors still beat the operation", () => {
    assert.equal(
      isInvalidationAccepted({
        notificationType: "DMSINV",
        rawPayload: ACCEPTED_CANCEL,
        originatingOperation: "cancel",
        errorCodes: ["CDS12015"],
      }),
      false,
    );
  });

  it("direct-HMRC rows with a CX- LRN still work without the operation", () => {
    assert.equal(
      isInvalidationAccepted({
        notificationType: "DMSINV",
        rawPayload: "<Response><FunctionalReferenceID>CX-abc123def456</FunctionalReferenceID></Response>",
      }),
      true,
    );
  });
});
