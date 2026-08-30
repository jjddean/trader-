import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  declarationHasImportDmscle,
  hasCds12015StateError,
  isAmendmentRejected,
  isAmendmentAcknowledged,
  isDmscleLifecycleOnly,
  isImportDmscleEvent,
  isInvalidationAccepted,
  isSubmitReceipt,
} from "../../convex/lib/notification_dms_context";
import { resolveDeclarationCdsBadge } from "../../convex/lib/cds_badge";
import { replayDeclarationStatus } from "../../convex/lib/replay_declaration_status";
import { statusAfterNotification } from "../../convex/lib/notification_status";

const originalHmrcEnv = process.env.HMRC_ENVIRONMENT;

const AMEND_REJECT_XML = `
<Response>
  <FunctionCode>03</FunctionCode>
  <Error><ValidationCode>CDS13000</ValidationCode></Error>
  <Declaration>
    <FunctionalReferenceID>AM-kn7ce59qgf4szvq174agcnm4ns880s39</FunctionalReferenceID>
    <ID>26GB65FDQ6Y57UGAR0</ID>
  </Declaration>
</Response>`;

describe("notification DMS context", () => {
  it("treats AM- LRN + DMSREJ (FC 03) as amendment rejected, not cancel", () => {
    const ctx = {
      notificationType: "DMSREJ",
      rawPayload: AMEND_REJECT_XML,
      errorCodes: ["CDS13000"],
      fieldErrors: [{ field: "42A/67A/68A item 1", reason: "CDS13000", code: "CDS13000" }],
    };
    assert.equal(isAmendmentRejected(ctx), true);
    assert.equal(isInvalidationAccepted(ctx), false);
  });

  it("does not treat AM- LRN without errors as amendment rejected", () => {
    const ctx = {
      notificationType: "DMSRCV",
      rawPayload: `
        <Response><FunctionCode>02</FunctionCode>
        <Declaration><FunctionalReferenceID>AM-kn7ce59qgf4szvq174agcnm4ns880s39</FunctionalReferenceID>
        <ID>26GB664W3BLIFZFAR4</ID></Declaration></Response>`,
      errorCodes: [],
      fieldErrors: [],
    };
    assert.equal(isAmendmentRejected(ctx), false);
    assert.equal(isAmendmentAcknowledged(ctx), true);
  });

  it("keeps Accepted when FC 02 amend ack arrives after a rejected amend", () => {
    const fc02Ack = `
      <Response><FunctionCode>02</FunctionCode>
      <Declaration><FunctionalReferenceID>AM-jpyv90jbvmt1d2t0ny188fa8r-4UZ5WB</FunctionalReferenceID>
      <ID>26GB6F8QX9AC62SAR0</ID></Declaration></Response>`;
    const status = replayDeclarationStatus(
      "Accepted",
      "26GB6F8QX9AC62SAR0",
      [
        {
          mrn: "26GB6F8QX9AC62SAR0",
          notificationType: "DMSREJ",
          rawPayload: AMEND_REJECT_XML,
          errorCodes: ["CDS13000"],
          timestamp: "2026-06-11T20:04:22Z",
        },
        {
          mrn: "26GB6F8QX9AC62SAR0",
          notificationType: "DMSRCV",
          rawPayload: fc02Ack,
          errorCodes: [],
          timestamp: "2026-06-11T21:10:55Z",
        },
      ],
    );
    assert.equal(status, "Accepted");
  });

  it("badge shows amend processing after FC 02 ack without DMSRES", () => {
    const fc02Ack = `
      <Response><FunctionCode>02</FunctionCode>
      <Declaration><FunctionalReferenceID>AM-jpyv90jbvmt1d2t0ny188fa8r</FunctionalReferenceID>
      <ID>26GB6F8QX9AC62SAR0</ID></Declaration></Response>`;
    const badge = resolveDeclarationCdsBadge("Amendment Processing", [
      { notificationType: "DMSRCV", rawPayload: fc02Ack, errorCodes: [], fieldErrors: [] },
    ]);
    assert.equal(badge.label, "Accepted — amend processing");
    assert.equal(badge.tone, "info");
  });

  it("keeps Accepted status when amendment is rejected", () => {
    assert.equal(
      statusAfterNotification({
        currentStatus: "Accepted",
        notificationType: "DMSREJ",
        hasResolvedMrn: true,
        isAmendmentRejected: true,
        isAmendmentAccepted: false,
        isInvalidationAccepted: false,
      }),
      "Accepted",
    );
  });

  it("replays DMSRES amend success to Amended status", () => {
    const dmsres = `
      <Response><FunctionCode>07</FunctionCode>
      <Amendment><ChangeReasonCode>21</ChangeReasonCode></Amendment>
      <Declaration><ID>26GB664W3BLIFZFAR4</ID><VersionID>2</VersionID></Declaration>
      </Response>`;
    const status = replayDeclarationStatus(
      "Action Required",
      "26GB664W3BLIFZFAR4",
      [
        { mrn: "26GB664W3BLIFZFAR4", notificationType: "DMSACC", timestamp: "2026-06-05T11:11:54Z" },
        { mrn: "26GB664W3BLIFZFAR4", notificationType: "DMSRES", rawPayload: dmsres, timestamp: "2026-06-05T11:12:02Z" },
      ],
    );
    assert.equal(status, "Amended");
  });

  it("promotes to Cleared from DMSCLE in sandbox", () => {
    process.env.HMRC_ENVIRONMENT = "sandbox";
    assert.equal(
      statusAfterNotification({
        currentStatus: "Accepted",
        notificationType: "DMSCLE",
        hasResolvedMrn: true,
        isAmendmentRejected: false,
        isAmendmentAccepted: false,
        isInvalidationAccepted: false,
      }),
      "Cleared",
    );
    process.env.HMRC_ENVIRONMENT = originalHmrcEnv;
  });

  it("does not treat import DMSCLE as lifecycle-only in sandbox", () => {
    process.env.HMRC_ENVIRONMENT = "sandbox";
    assert.equal(
      isDmscleLifecycleOnly({
        notificationType: "DMSCLE",
        rawPayload: "<Response><FunctionCode>09</FunctionCode></Response>",
      }),
      false,
    );
    process.env.HMRC_ENVIRONMENT = originalHmrcEnv;
  });

  it("replays submit FC 02 receipt to Received", () => {
    const submitReceipt = `
      <Response><FunctionCode>02</FunctionCode>
      <Declaration><FunctionalReferenceID>FC-MTCZ1U8O</FunctionalReferenceID>
      <ID>26GB9IAK3PBQ9J8AA6</ID></Declaration></Response>`;
    const status = replayDeclarationStatus(
      "Processing",
      "26GB9IAK3PBQ9J8AA6",
      [
        {
          mrn: "26GB9IAK3PBQ9J8AA6",
          notificationType: "DMSRCV",
          rawPayload: submitReceipt,
          errorCodes: [],
          timestamp: "2026-08-28T13:12:46Z",
          originatingOperation: "submit",
        },
      ],
    );
    assert.equal(status, "Received");
  });

  it("replays legacy stored DMSINV submit receipt (FC 02 XML) to Received", () => {
    const submitReceipt = `
      <Response><FunctionCode>02</FunctionCode>
      <Declaration><FunctionalReferenceID>FC-MTCC1HGJ</FunctionalReferenceID>
      <ID>26GB9HNJRDCHXH9AA4</ID></Declaration></Response>`;
    const status = replayDeclarationStatus(
      "Processing",
      "26GB9HNJRDCHXH9AA4",
      [
        {
          mrn: "26GB9HNJRDCHXH9AA4",
          notificationType: "DMSINV",
          rawPayload: submitReceipt,
          errorCodes: [],
          timestamp: "2026-08-28T12:00:00Z",
          originatingOperation: "submit",
        },
      ],
    );
    assert.equal(status, "Received");
  });

  it("does not treat CNS cancel DMSRCV (FC 02) as cancellation", () => {
    const cancelReceipt = `
      <Response><FunctionCode>02</FunctionCode>
      <Declaration><FunctionalReferenceID>FC-MSUX9NFX</FunctionalReferenceID>
      <ID>26GB908RYZ3SRUKAR0</ID></Declaration></Response>`;
    const status = replayDeclarationStatus(
      "Processing",
      "26GB908RYZ3SRUKAR0",
      [
        {
          mrn: "26GB908RYZ3SRUKAR0",
          notificationType: "DMSRCV",
          rawPayload: cancelReceipt,
          errorCodes: [],
          timestamp: "2026-08-15T23:04:14Z",
          originatingOperation: "cancel",
        },
      ],
    );
    assert.equal(status, "Received");
  });

  it("detects submit receipt via isSubmitReceipt", () => {
    assert.equal(
      isSubmitReceipt({
        notificationType: "DMSRCV",
        rawPayload: "<Declaration><FunctionalReferenceID>FC-MTCZ1U8O</FunctionalReferenceID></Declaration>",
        originatingOperation: "submit",
      }),
      true,
    );
    assert.equal(
      isSubmitReceipt({
        notificationType: "DMSINV",
        rawPayload: "<Declaration><FunctionalReferenceID>FC-MTCZ1U8O</FunctionalReferenceID></Declaration>",
        originatingOperation: "submit",
      }),
      false,
    );
    assert.equal(
      isSubmitReceipt({
        notificationType: "DMSRCV",
        rawPayload: "<Declaration><FunctionalReferenceID>FC-MSUX9NFX</FunctionalReferenceID></Declaration>",
        originatingOperation: "cancel",
      }),
      false,
    );
  });

  it("replays cancel DMSINV (FC 10) from MRN-scoped notification to Cancelled", () => {
    const cancelInv = `
      <Response><FunctionCode>10</FunctionCode>
      <Declaration>
        <FunctionalReferenceID>CX-kn73a2vpts1b6j7tsfy7ct7mms832vkx</FunctionalReferenceID>
        <ID>26GB65AQTKWFMT6AR3</ID>
        <CancellationDateTime>2026-06-06T02:20:00Z</CancellationDateTime>
      </Declaration>
      </Response>`;
    const status = replayDeclarationStatus(
      "Processing",
      "26GB65AQTKWFMT6AR3",
      [
        {
          mrn: "26GB65AQTKWFMT6AR3",
          notificationType: "DMSINV",
          rawPayload: cancelInv,
          timestamp: "2026-06-06T02:20:54Z",
        },
      ],
    );
    assert.equal(status, "Cancelled");
  });

  it("detects import DMSCLE as blocking amend state", () => {
    assert.equal(
      isImportDmscleEvent({ notificationType: "DMSCLE", rawPayload: "<Response/>" }),
      true,
    );
    assert.equal(
      isImportDmscleEvent({
        notificationType: "DMSCLE",
        rawPayload: "<Declaration><FunctionalReferenceID>CX-kn73a2vabc</FunctionalReferenceID></Declaration>",
      }),
      false,
    );
    assert.equal(
      declarationHasImportDmscle([
        { notificationType: "DMSACC", rawPayload: "" },
        { notificationType: "DMSCLE", rawPayload: "<Response/>" },
      ]),
      true,
    );
  });

  it("detects CDS12015 on amend rejection", () => {
    const xml = `
      <Response><FunctionCode>03</FunctionCode>
      <Error><ValidationCode>CDS12015</ValidationCode>
      <Pointer><DocumentSectionCode>42A</DocumentSectionCode><TagID>D014</TagID></Pointer></Error>
      <Declaration><FunctionalReferenceID>AM-jpyv90jbvmt1d2t0ny188fa8r-0FIFPK</FunctionalReferenceID><ID>26GB6F8QX9AC62SAR0</ID></Declaration>
      </Response>`;
    const ctx = { notificationType: "DMSREJ", rawPayload: xml, errorCodes: ["CDS12015"] };
    assert.equal(hasCds12015StateError(ctx), true);
    assert.equal(isAmendmentRejected(ctx), true);
  });
});
