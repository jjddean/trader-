import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAmendmentRejected,
  isInvalidationAccepted,
} from "../../convex/lib/notification_dms_context";
import { replayDeclarationStatus } from "../../convex/lib/replay_declaration_status";
import { statusAfterNotification } from "../../convex/lib/notification_status";

const originalHmrcEnv = process.env.HMRC_ENVIRONMENT;

const AMEND_REJECT_XML = `
<Response>
  <FunctionCode>02</FunctionCode>
  <Error><ValidationCode>CDS13000</ValidationCode></Error>
  <Declaration>
    <FunctionalReferenceID>AM-kn7ce59qgf4szvq174agcnm4ns880s39</FunctionalReferenceID>
    <ID>26GB65FDQ6Y57UGAR0</ID>
  </Declaration>
</Response>`;

describe("notification DMS context", () => {
  it("treats AM- LRN + CDS13000 as amendment rejected, not cancel", () => {
    const ctx = {
      notificationType: "DMSINV",
      rawPayload: AMEND_REJECT_XML,
      errorCodes: ["CDS13000"],
      fieldErrors: [{ field: "42A/67A/68A item 1", reason: "CDS13000", code: "CDS13000" }],
    };
    assert.equal(isAmendmentRejected(ctx), true);
    assert.equal(isInvalidationAccepted(ctx), false);
  });

  it("does not treat AM- LRN without errors as amendment rejected", () => {
    const ctx = {
      notificationType: "DMSINV",
      rawPayload: `
        <Response><FunctionCode>02</FunctionCode>
        <Declaration><FunctionalReferenceID>AM-kn7ce59qgf4szvq174agcnm4ns880s39</FunctionalReferenceID>
        <ID>26GB664W3BLIFZFAR4</ID></Declaration></Response>`,
      errorCodes: [],
      fieldErrors: [],
    };
    assert.equal(isAmendmentRejected(ctx), false);
  });

  it("keeps Accepted status when amendment is rejected", () => {
    assert.equal(
      statusAfterNotification({
        currentStatus: "Accepted",
        notificationType: "DMSINV",
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

  it("does not promote to Cleared from DMSCLE in sandbox", () => {
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
      "Accepted",
    );
    process.env.HMRC_ENVIRONMENT = originalHmrcEnv;
  });
});
