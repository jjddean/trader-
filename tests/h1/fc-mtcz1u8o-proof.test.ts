import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseHmrcNotification } from "../../src/lib/hmrc-notification-parser";
import { replayDeclarationStatus } from "../../convex/lib/replay_declaration_status";
import { resolveDeclarationCdsBadge } from "../../convex/lib/cds_badge";
import { resolveTimelineNotificationMeta } from "../../src/lib/notification-context";

/** Live TDR response — FC-MTCZ1U8O / 26GB9IAK3PBQ9J8AA6 (2026-08-28T13:12:46Z) */
const FC_MTCZ1U8O_XML = `<_2:MetaData xmlns:_2="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2"><_2:WCODataModelVersionCode>3.6</_2:WCODataModelVersionCode><_2:WCOTypeName>RES</_2:WCOTypeName><_2:ResponsibleCountryCode/><_2:ResponsibleAgencyName/><_2:AgencyAssignedCustomizationCode/><_2:AgencyAssignedCustomizationVersionCode/><_2_1:Response xmlns:_2_1="urn:wco:datamodel:WCO:RES-DMS:2">
      <_2_1:FunctionCode>02</_2_1:FunctionCode>
      <_2_1:FunctionalReferenceID>4eb64cebc805434793bf462f3e38fcd5</_2_1:FunctionalReferenceID>
      <_2_1:IssueDateTime>
        <_2_2:DateTimeString formatCode="304" xmlns:_2_2="urn:wco:datamodel:WCO:Response_DS:DMS:2">20260828131246Z</_2_2:DateTimeString>
      </_2_1:IssueDateTime>
      <_2_1:Declaration>
        <_2_1:FunctionalReferenceID>FC-MTCZ1U8O</_2_1:FunctionalReferenceID>
        <_2_1:ID>26GB9IAK3PBQ9J8AA6</_2_1:ID>
        <_2_1:VersionID>1</_2_1:VersionID>
      </_2_1:Declaration>
    </_2_1:Response></_2:MetaData>`;

const FC_MTCC1HGJ_XML = `<_2_1:Response xmlns:_2_1="urn:wco:datamodel:WCO:RES-DMS:2">
  <_2_1:FunctionCode>02</_2_1:FunctionCode>
  <_2_1:Declaration>
    <_2_1:FunctionalReferenceID>FC-MTCC1HGJ</_2_1:FunctionalReferenceID>
    <_2_1:ID>26GB9HNJRDCHXH9AA4</_2_1:ID>
  </_2_1:Declaration>
</_2_1:Response>`;

describe("FC-MTCZ1U8O submit receipt proof", () => {
  it("parses FunctionCode 02 as DMSRCV with MRN", () => {
    const parsed = parseHmrcNotification(FC_MTCZ1U8O_XML);
    assert.equal(parsed.notificationType, "DMSRCV");
    assert.equal(parsed.functionCode, "02");
    assert.equal(parsed.mrn, "26GB9IAK3PBQ9J8AA6");
    assert.deepEqual(parsed.errorCodes, []);
    assert.equal(parsed.issueDateTime, "2026-08-28T13:12:46Z");
  });

  it("replays a legacy stored DMSINV row to Received, badge DMSRCV not DMSACC", () => {
    const row = {
      mrn: "26GB9IAK3PBQ9J8AA6",
      notificationType: "DMSINV",
      rawPayload: FC_MTCZ1U8O_XML,
      errorCodes: [] as string[],
      timestamp: "2026-08-28T13:12:46Z",
      originatingOperation: "submit",
    };
    const status = replayDeclarationStatus("Invalid", "26GB9IAK3PBQ9J8AA6", [row]);
    assert.equal(status, "Received");
    assert.equal(status, "Received");
    const badge = resolveDeclarationCdsBadge(status, [row]);
    assert.equal(badge.label, "Received by HMRC (DMSRCV)");
    assert.equal(badge.tone, "info");
    assert.doesNotMatch(badge.label, /DMSACC/);
  });

  it("timeline shows registered, not invalid or accepted", () => {
    const row = {
      notificationType: "DMSINV",
      rawPayload: FC_MTCZ1U8O_XML,
      errorCodes: [] as string[],
      originatingOperation: "submit",
    };
    const meta = resolveTimelineNotificationMeta(row, {
      title: "placeholder",
      detail: "placeholder",
      color: "bg-red-500",
      icon: "danger",
      normalizedType: "DMSINV",
    });
    assert.equal(meta.normalizedType, "DMSRCV");
    assert.equal(meta.title, "Message registered (DMSRCV)");
    assert.equal(meta.icon, "info");
    assert.equal(meta.showFieldErrors, false);
  });
});

describe("FC-MTCC1HGJ FunctionCode 02", () => {
  it("is DMSRCV from XML even if stored as DMSINV", () => {
    const parsed = parseHmrcNotification(FC_MTCC1HGJ_XML);
    assert.equal(parsed.notificationType, "DMSRCV");
    const row = {
      mrn: "26GB9HNJRDCHXH9AA4",
      notificationType: "DMSINV",
      rawPayload: FC_MTCC1HGJ_XML,
      errorCodes: [] as string[],
      originatingOperation: "submit",
    };
    assert.equal(replayDeclarationStatus("Processing", "26GB9HNJRDCHXH9AA4", [row]), "Received");
    assert.equal(resolveDeclarationCdsBadge("Processing", [row]).label, "Received by HMRC (DMSRCV)");
  });
});
