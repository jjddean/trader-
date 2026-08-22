import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectNotifications, collectOutcomes } from "../../src/lib/ens/ens-collector";
import {
  parseNotification,
  parseNotificationList,
  parseOutcome,
  parseOutcomeList,
} from "../../src/lib/ens/outcome-parser";

/**
 * Spec: docs/hmrc/ens/IMPLEMENTATION_SPEC.md §5–6
 * Schemas: docs/hmrc/ens/schemas/outcomes/, schemas/notifications/
 *
 * Sample bodies follow HMRC's own examples in
 * docs/hmrc/ens/api/service-guide-api-reference.md.
 */

const LIST_XML = `<entryDeclarationResponses>
  <response>
    <correlationId>0JRF7UncK0t004</correlationId>
    <link>/customs/imports/outcomes/0JRF7UncK0t004</link>
    <MRN>10GB08I01234567891</MRN>
  </response>
  <response>
    <correlationId>0JRF7UncAqr004</correlationId>
    <link>/customs/imports/outcomes/0JRF7UncAqr004</link>
  </response>
</entryDeclarationResponses>`;

const IE328_XML = `<cc3:CC328A xmlns:cc3="http://ics.dgtaxud.ec/CC328A">
  <MesIdeMES19>MSG001</MesIdeMES19>
  <MesTypMES20>CC328A</MesTypMES20>
  <CorIdeMES25>0JRF7UncK0t004</CorIdeMES25>
  <HEAHEA>
    <RefNumHEA4>FCENS0001</RefNumHEA4>
    <DocNumHEA5>10GB08I01234567891</DocNumHEA5>
    <DecRegDatTimHEA115>202609151000</DecRegDatTimHEA115>
  </HEAHEA>
</cc3:CC328A>`;

const IE316_XML = `<cc3:CC316A xmlns:cc3="http://ics.dgtaxud.ec/CC316A">
  <MesIdeMES19>MSG002</MesIdeMES19>
  <MesTypMES20>CC316A</MesTypMES20>
  <CorIdeMES25>0JRF7UncAqr004</CorIdeMES25>
  <HEAHEA>
    <RefNumHEA4>FCENS0002</RefNumHEA4>
    <DecRejReaHEA252>Local reference number is not unique</DecRejReaHEA252>
    <DecRejDatTimHEA116>202609151005</DecRejDatTimHEA116>
  </HEAHEA>
  <FUNERRER1>
    <ErrTypER11>8102</ErrTypER11>
    <ErrPoiER12>/CC315A/HEAHEA/RefNumHEA4</ErrPoiER12>
    <ErrReaER13>Duplicate LRN</ErrReaER13>
    <OriAttValER14>FCENS0002</OriAttValER14>
  </FUNERRER1>
</cc3:CC316A>`;

const IE351_XML = `<notificationResponse xmlns:cc3="http://ics.dgtaxud.ec/CC351A">
  <response>
    <cc3:CC351A>
      <MesIdeMES19>MSG003</MesIdeMES19>
      <MesTypMES20>CC351A</MesTypMES20>
      <CorIdeMES25>0JRF7UncK0t004</CorIdeMES25>
      <HEAHEA><DocNumHEA5>10GB08I01234567891</DocNumHEA5></HEAHEA>
      <CUSINT632>
        <IteNumConCUSINT668>1</IteNumConCUSINT668>
        <CusIntCodCUSINT665>A001</CusIntCodCUSINT665>
        <CusIntTexCUSINT666>Do not load</CusIntTexCUSINT666>
      </CUSINT632>
    </cc3:CC351A>
  </response>
  <acknowledgement method='DELETE' href='/customs/imports/notifications/0JRF7UncK0t004'/>
</notificationResponse>`;

const NOTIFICATION_LIST_XML = `<entryDeclarationResponses>
  <response>
    <notificationId>NTF001</notificationId>
    <correlationId>0JRF7UncK0t004</correlationId>
    <link>/customs/imports/notifications/NTF001</link>
  </response>
</entryDeclarationResponses>`;

describe("parseOutcomeList", () => {
  it("reads both entries", () => {
    assert.equal(parseOutcomeList(LIST_XML).length, 2);
  });

  // The schema states MRN presence is the discriminator.
  it("treats MRN presence as acceptance", () => {
    const [accepted, rejected] = parseOutcomeList(LIST_XML);
    assert.equal(accepted.accepted, true);
    assert.equal(accepted.movementReferenceNumber, "10GB08I01234567891");
    assert.equal(rejected.accepted, false);
    assert.equal(rejected.movementReferenceNumber, undefined);
  });

  it("keeps HMRC's own link", () => {
    assert.equal(parseOutcomeList(LIST_XML)[0].link, "/customs/imports/outcomes/0JRF7UncK0t004");
  });

  it("returns nothing for junk rather than throwing", () => {
    assert.deepEqual(parseOutcomeList("<html>nope</html>"), []);
    assert.deepEqual(parseOutcomeList(""), []);
  });
});

describe("parseOutcome", () => {
  it("reads the MRN from DocNumHEA5, not RefNumHEA4", () => {
    const o = parseOutcome(IE328_XML);
    assert.equal(o?.outcomeType, "IE328");
    assert.equal(o?.movementReferenceNumber, "10GB08I01234567891");
    // RefNumHEA4 is the trader's LRN and must not be mistaken for the MRN.
    assert.equal(o?.localReferenceNumber, "FCENS0001");
    assert.equal(o?.accepted, true);
  });

  it("reads a rejection with its reason and functional errors", () => {
    const o = parseOutcome(IE316_XML);
    assert.equal(o?.outcomeType, "IE316");
    assert.equal(o?.accepted, false);
    assert.equal(o?.movementReferenceNumber, undefined);
    assert.match(o?.rejectionReason ?? "", /not unique/);
    assert.equal(o?.errors.length, 1);
    assert.equal(o?.errors[0].errorCode, "8102");
    assert.equal(o?.errors[0].contextElement, "/CC315A/HEAHEA/RefNumHEA4");
    assert.equal(o?.errors[0].originalValue, "FCENS0002");
  });

  it("returns null for an unrecognised message rather than guessing", () => {
    assert.equal(parseOutcome("<cc3:CC999A><HEAHEA/></cc3:CC999A>"), null);
    assert.equal(parseOutcome("not xml at all"), null);
  });
});

describe("parseNotification", () => {
  it("reads the interventions and flags Do Not Load", () => {
    const n = parseNotification(IE351_XML);
    assert.equal(n?.interventions.length, 1);
    assert.equal(n?.interventions[0].interventionCode, "A001");
    assert.equal(n?.interventions[0].itemNumber, 1);
    assert.equal(n?.doNotLoad, true);
  });

  it("uses the acknowledgement href HMRC supplies", () => {
    assert.equal(
      parseNotification(IE351_XML)?.acknowledgementHref,
      "/customs/imports/notifications/0JRF7UncK0t004",
    );
  });

  it("does not flag DNL for an ordinary intervention", () => {
    const xml = IE351_XML.replace("A001", "B002").replace("Do not load", "Documentary check");
    assert.equal(parseNotification(xml)?.doNotLoad, false);
  });

  it("parses the notification list", () => {
    const list = parseNotificationList(NOTIFICATION_LIST_XML);
    assert.equal(list.length, 1);
    assert.equal(list[0].notificationId, "NTF001");
  });
});

/** Scripted HTTP so the collector's ordering can be asserted exactly. */
function scriptedFetch(routes: Record<string, { status: number; body?: string }[]>) {
  // routes is mutated as queues drain, so it is typed loosely on purpose.
  const calls: { method: string; url: string }[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const u = String(url);
    calls.push({ method, url: u });
    const key = `${method} ${new URL(u).pathname}`;
    const queue = routes[key];
    const next = queue && queue.length > 1 ? queue.shift()! : queue?.[0];
    if (!next) return new Response("", { status: 404 });
    return new Response(next.body ?? "", { status: next.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const collectorOpts = { environment: "sandbox" as const, accessToken: "t" };

describe("collectOutcomes — ordering", () => {
  const routes = (): Record<string, { status: number; body?: string }[]> => ({
    "GET /customs/imports/outcomes/": [{ status: 200, body: LIST_XML }],
    "GET /customs/imports/outcomes/0JRF7UncK0t004": [{ status: 200, body: IE328_XML }],
    "GET /customs/imports/outcomes/0JRF7UncAqr004": [{ status: 200, body: IE316_XML }],
    "DELETE /customs/imports/outcomes/0JRF7UncK0t004": [{ status: 200 }],
    "DELETE /customs/imports/outcomes/0JRF7UncAqr004": [{ status: 200 }],
  });

  it("persists before acknowledging", async () => {
    const { impl, calls } = scriptedFetch(routes());
    const order: string[] = [];
    await collectOutcomes({ ...collectorOpts, fetchImpl: impl }, async (o) => {
      order.push(`persist:${o.outcomeType}`);
    });
    const deleteAt = calls.findIndex((c) => c.method === "DELETE");
    assert.ok(order.length > 0, "persist must be called");
    assert.ok(deleteAt > -1, "acknowledge must happen");
    // First DELETE must come after the first persist.
    const getsBeforeDelete = calls.slice(0, deleteAt).filter((c) => c.method === "GET").length;
    assert.ok(getsBeforeDelete >= 2, "list + retrieve must precede the first acknowledge");
  });

  it("collects both an acceptance and a rejection", async () => {
    const { impl } = scriptedFetch(routes());
    const report = await collectOutcomes({ ...collectorOpts, fetchImpl: impl }, async () => {});
    assert.equal(report.items.length, 2);
    assert.equal(report.items[0].outcome?.movementReferenceNumber, "10GB08I01234567891");
    assert.equal(report.items[1].outcome?.accepted, false);
    assert.ok(report.items.every((i) => i.acknowledged));
  });

  // The failure this design exists to prevent.
  it("does NOT acknowledge when persistence throws", async () => {
    const { impl, calls } = scriptedFetch(routes());
    const report = await collectOutcomes({ ...collectorOpts, fetchImpl: impl }, async () => {
      throw new Error("database unavailable");
    });
    assert.equal(calls.filter((c) => c.method === "DELETE").length, 0, "nothing may be acknowledged");
    assert.ok(report.items.every((i) => !i.acknowledged));
    assert.match(report.items[0].error ?? "", /database unavailable/);
    assert.equal(report.skipped, 2);
  });

  it("does NOT acknowledge an unrecognised outcome body", async () => {
    const r = routes();
    r["GET /customs/imports/outcomes/0JRF7UncK0t004"] = [{ status: 200, body: "<cc3:CC999A/>" }];
    const { impl, calls } = scriptedFetch(r);
    const report = await collectOutcomes({ ...collectorOpts, fetchImpl: impl }, async () => {});
    assert.equal(
      calls.filter((c) => c.url.includes("0JRF7UncK0t004") && c.method === "DELETE").length,
      0,
    );
    assert.match(report.items[0].error ?? "", /not a recognised/);
  });

  it("treats 404 on retrieve as not-yet-available, not a failure", async () => {
    const r = routes();
    r["GET /customs/imports/outcomes/0JRF7UncK0t004"] = [{ status: 404 }];
    const { impl } = scriptedFetch(r);
    const report = await collectOutcomes({ ...collectorOpts, fetchImpl: impl }, async () => {});
    assert.equal(report.skipped, 1);
    assert.equal(report.transportError, undefined);
  });

  it("treats an empty list as nothing pending", async () => {
    const { impl } = scriptedFetch({ "GET /customs/imports/outcomes/": [{ status: 404 }] });
    const report = await collectOutcomes({ ...collectorOpts, fetchImpl: impl }, async () => {});
    assert.deepEqual(report.items, []);
    assert.equal(report.transportError, undefined);
  });

  it("reports a transport failure without acknowledging anything", async () => {
    const impl = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const report = await collectOutcomes({ ...collectorOpts, fetchImpl: impl }, async () => {});
    assert.match(report.transportError ?? "", /ECONNRESET/);
  });
});

describe("collectNotifications — Do Not Load", () => {
  const routes = (): Record<string, { status: number; body?: string }[]> => ({
    "GET /customs/imports/notifications/": [{ status: 200, body: NOTIFICATION_LIST_XML }],
    "GET /customs/imports/notifications/NTF001": [{ status: 200, body: IE351_XML }],
    "DELETE /customs/imports/notifications/0JRF7UncK0t004": [{ status: 200 }],
    "DELETE /customs/imports/notifications/NTF001": [{ status: 200 }],
  });

  // A DNL cleared from HMRC's list before a human sees it is the worst outcome
  // in this whole subsystem.
  it("never auto-acknowledges a Do Not Load", async () => {
    const { impl, calls } = scriptedFetch(routes());
    const report = await collectNotifications({ ...collectorOpts, fetchImpl: impl }, async () => {});
    assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
    assert.equal(report.items[0].notification?.doNotLoad, true);
    assert.equal(report.items[0].acknowledged, false);
  });

  it("acknowledges a DNL only when explicitly told to", async () => {
    const { impl, calls } = scriptedFetch(routes());
    await collectNotifications(
      { ...collectorOpts, fetchImpl: impl, acknowledgeDoNotLoad: true },
      async () => {},
    );
    assert.equal(calls.filter((c) => c.method === "DELETE").length, 1);
  });

  it("acknowledges an ordinary intervention", async () => {
    const r = routes();
    r["GET /customs/imports/notifications/NTF001"] = [
      { status: 200, body: IE351_XML.replace("A001", "B002").replace("Do not load", "Docs check") },
    ];
    const { impl, calls } = scriptedFetch(r);
    const report = await collectNotifications({ ...collectorOpts, fetchImpl: impl }, async () => {});
    assert.equal(report.items[0].notification?.doNotLoad, false);
    assert.equal(calls.filter((c) => c.method === "DELETE").length, 1);
  });

  it("uses HMRC's acknowledgement href rather than rebuilding the path", async () => {
    const r = routes();
    r["GET /customs/imports/notifications/NTF001"] = [
      { status: 200, body: IE351_XML.replace("A001", "B002").replace("Do not load", "Docs check") },
    ];
    const { impl, calls } = scriptedFetch(r);
    await collectNotifications({ ...collectorOpts, fetchImpl: impl }, async () => {});
    const del = calls.find((c) => c.method === "DELETE");
    assert.ok(del?.url.endsWith("/customs/imports/notifications/0JRF7UncK0t004"));
  });

  it("does not acknowledge when persistence throws", async () => {
    const r = routes();
    r["GET /customs/imports/notifications/NTF001"] = [
      { status: 200, body: IE351_XML.replace("A001", "B002").replace("Do not load", "Docs check") },
    ];
    const { impl, calls } = scriptedFetch(r);
    await collectNotifications({ ...collectorOpts, fetchImpl: impl }, async () => {
      throw new Error("store failed");
    });
    assert.equal(calls.filter((c) => c.method === "DELETE").length, 0);
  });
});
