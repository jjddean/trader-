import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAcknowledgementXml,
  classifyCnsNotification,
  decodeCnsBody,
  header,
  parseCnsBatch,
} from "../../convex/lib/cns_envelope";

/**
 * Fixtures are the published samples from CSP CDS Interface Specification —
 * Notification APIs v1.0.3 §9, including the typographic quotes the document
 * actually uses.
 */

const XML_BATCH_TWO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<notifications topic="TOPIC4" count="2">
<notification id="5231b533-ba17-4787-98a3-f2df37de2aD">
<queuedDateTime>2018-02-05T12:05:06.658Z</queuedDateTime>
<headers>
<header name="X-Badge-ID" value="ABC"/>
<header name="X-CSP-ID" value="ABC-1234567890123"/>
<header name="X-Notification-Type" value="API"/>
<header name="Content-Type" value="application/xml"/>
<header name="ConversationID" value="00001101-0000-1000-8000-00805f9b34fb"/>
</headers>
<body>PE1ldGFEYXRhPjwvTWV0YURhdGE+</body>
</notification>
<notification id="6b313534-bd23-12c2-44a3-d21f348e8a27" partition="6">
<queuedDateTime>2018-02-05T12:05:06.658Z</queuedDateTime>
<headers>
<header name="X-Badge-ID" value="ABC"/>
<header name="X-Notification-Type" value="DMS"/>
<header name="Content-Type" value="application/xml"/>
</headers>
<body>PE1ldGFEYXRhPjwvTWV0YURhdGE+</body>
</notification>
</notifications>`;

describe("parseCnsBatch — XML wrapper", () => {
  it("reads topic, count and every notification", () => {
    const batch = parseCnsBatch(XML_BATCH_TWO);
    assert.equal(batch.topic, "TOPIC4");
    assert.equal(batch.count, 2);
    assert.equal(batch.notifications.length, 2);
  });

  it("captures the notification id used as the dedupe key", () => {
    const batch = parseCnsBatch(XML_BATCH_TWO);
    assert.equal(batch.notifications[0].id, "5231b533-ba17-4787-98a3-f2df37de2aD");
    assert.equal(batch.notifications[1].id, "6b313534-bd23-12c2-44a3-d21f348e8a27");
  });

  it("reads the optional partition only when present", () => {
    const batch = parseCnsBatch(XML_BATCH_TWO);
    assert.equal(batch.notifications[0].partition, undefined);
    assert.equal(batch.notifications[1].partition, 6);
  });

  it("captures all headers per notification", () => {
    const [first] = parseCnsBatch(XML_BATCH_TWO).notifications;
    assert.equal(header(first.headers, "X-CSP-ID"), "ABC-1234567890123");
    assert.equal(header(first.headers, "X-Notification-Type"), "API");
    assert.equal(
      header(first.headers, "ConversationID"),
      "00001101-0000-1000-8000-00805f9b34fb",
    );
  });

  it("looks up headers case-insensitively", () => {
    const [first] = parseCnsBatch(XML_BATCH_TWO).notifications;
    assert.equal(header(first.headers, "x-csp-id"), "ABC-1234567890123");
  });

  it("tolerates the typographic quotes used in the published samples", () => {
    const curly = XML_BATCH_TWO.replace(/"/g, "”");
    const batch = parseCnsBatch(curly);
    assert.equal(batch.notifications.length, 2);
    assert.equal(batch.notifications[0].id, "5231b533-ba17-4787-98a3-f2df37de2aD");
  });

  it("returns an empty batch for an empty body (the 204 case)", () => {
    const batch = parseCnsBatch("");
    assert.equal(batch.count, 0);
    assert.deepEqual(batch.notifications, []);
  });
});

describe("parseCnsBatch — JSON wrapper", () => {
  const JSON_BATCH = JSON.stringify({
    topic: "CDSTOPIC",
    count: 1,
    notifications: [
      {
        id: "5231b533-ba17-4787-98a3-f2df37de2ad7",
        partition: 1,
        queuedDateTime: "2018-02-05T12:05:06.658",
        headers: [
          { name: "X-Badge-ID", value: "ABC" },
          // The published JSON sample has a stray trailing colon on these names.
          { name: "X-CSP-ID:", value: "ABC-1234567890123" },
          { name: "X-Notification-Type:", value: "API" },
        ],
        body: "PE1ldGFEYXRhPjwvTWV0YURhdGE+",
      },
    ],
  });

  it("parses the JSON shape", () => {
    const batch = parseCnsBatch(JSON_BATCH);
    assert.equal(batch.topic, "CDSTOPIC");
    assert.equal(batch.notifications.length, 1);
    assert.equal(batch.notifications[0].partition, 1);
  });

  it("strips the stray trailing colon from header names", () => {
    const [first] = parseCnsBatch(JSON_BATCH).notifications;
    assert.equal(header(first.headers, "X-CSP-ID"), "ABC-1234567890123");
    assert.equal(header(first.headers, "X-Notification-Type"), "API");
  });
});

describe("decodeCnsBody", () => {
  it("base64-decodes the body", () => {
    const { text } = decodeCnsBody("PE1ldGFEYXRhPjwvTWV0YURhdGE+");
    assert.equal(text, "<MetaData></MetaData>");
  });

  it("reports the decoded byte length", () => {
    const { byteLength } = decodeCnsBody("PE1ldGFEYXRhPjwvTWV0YURhdGE+");
    assert.equal(byteLength, 21);
  });

  it("does not throw on an empty body", () => {
    assert.deepEqual(decodeCnsBody(""), { text: "", byteLength: 0 });
  });

  it("decodes multi-byte UTF-8 correctly", () => {
    // Trader names and addresses in DMS bodies are not ASCII. A binary-string
    // decode would mangle these silently.
    const source = "<Name>Kühne Nagel — Ćuprija</Name>";
    const encoded = Buffer.from(source, "utf8").toString("base64");
    assert.equal(decodeCnsBody(encoded).text, source);
  });

  it("reports byte length, not character count, for multi-byte content", () => {
    const encoded = Buffer.from("café", "utf8").toString("base64");
    const { text, byteLength } = decodeCnsBody(encoded);
    assert.equal(text, "café");
    assert.equal(byteLength, 5);
  });
});

describe("classifyCnsNotification", () => {
  const envelope = (headers: Record<string, string>) => ({
    id: "n1",
    headers,
    bodyBase64: "",
  });

  it("classifies API, DMS and CILE from X-Notification-Type", () => {
    assert.equal(classifyCnsNotification(envelope({ "X-Notification-Type": "API" })), "API");
    assert.equal(classifyCnsNotification(envelope({ "X-Notification-Type": "DMS" })), "DMS");
    assert.equal(classifyCnsNotification(envelope({ "X-Notification-Type": "CILE" })), "CILE");
  });

  it("detects a heartbeat from the Test header", () => {
    assert.equal(classifyCnsNotification(envelope({ Test: "Test" })), "HEARTBEAT");
  });

  it("detects a heartbeat from its body when no Test header is present", () => {
    assert.equal(
      classifyCnsNotification(envelope({}), '<heartbeat requestDateTime="2018-02-06T09:04:00.000Z"></heartbeat>'),
      "HEARTBEAT",
    );
    assert.equal(
      classifyCnsNotification(envelope({}), '{"type": "heartbeat"}'),
      "HEARTBEAT",
    );
  });

  it("returns UNKNOWN rather than guessing", () => {
    assert.equal(classifyCnsNotification(envelope({})), "UNKNOWN");
    assert.equal(
      classifyCnsNotification(envelope({ "X-Notification-Type": "SOMETHING_NEW" })),
      "UNKNOWN",
    );
  });
});

describe("buildAcknowledgementXml", () => {
  it("emits the documented <notifications><id> shape", () => {
    const xml = buildAcknowledgementXml([
      "5231b533-ba17-4787-98a3-f2df37de2ad7",
      "1231d433-fc27-4787-98a3-f2da38a82aa7",
    ]);
    assert.match(xml, /^<notifications>/);
    assert.match(xml, /<id>5231b533-ba17-4787-98a3-f2df37de2ad7<\/id>/);
    assert.match(xml, /<id>1231d433-fc27-4787-98a3-f2da38a82aa7<\/id>/);
    assert.match(xml, /<\/notifications>$/);
  });

  it("drops blank ids rather than emitting empty elements", () => {
    const xml = buildAcknowledgementXml(["a", "", "  ", "b"]);
    assert.equal((xml.match(/<id>/g) || []).length, 2);
  });
});
