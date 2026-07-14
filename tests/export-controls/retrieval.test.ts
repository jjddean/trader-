import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { ControlListSnapshot } from "../../src/lib/export-controls/control-list";
import { retrieveControlListCandidates, specsToProduct } from "../../src/lib/export-controls/retrieval";
import { runPredicates } from "../../src/lib/export-controls/predicates";
import { computeClassificationConfidence } from "../../src/lib/export-controls/confidence";

const snapshotPath = path.join(process.cwd(), "data", "export-controls", "v2025-12-16.json");
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as ControlListSnapshot;

describe("control list retrieval", () => {
  it("ranks 5A002 for crypto product facts", () => {
    const product = specsToProduct({
      name: "Secure VPN gateway",
      techDescription: "AES-256 encryption module for industrial VPN and TLS traffic",
      specs: [
        { key: "encryption", valueRaw: "AES-256", valueNum: 256, unit: "bit", confidence: 0.9 },
      ],
    });

    const hits = retrieveControlListCandidates(snapshot, product, { limit: 8 });
    assert.ok(hits.length > 0);
    assert.equal(hits[0].entryCode, "5A002");
  });

  it("finds ML entries for military keywords", () => {
    const product = specsToProduct({
      name: "Assault rifle components",
      techDescription: "Military weapon barrel and firing mechanism parts",
    });

    const hits = retrieveControlListCandidates(snapshot, product, { limit: 6 });
    assert.ok(hits.some((h) => h.entryCode.startsWith("ML")));
  });

  it("does not surface ML1 for an industrial centrifugal pump on generic wording", () => {
    const product = specsToProduct({
      name: "Industrial centrifugal pump",
      techDescription: "Industrial centrifugal pump for water transfer",
    });

    const hits = retrieveControlListCandidates(snapshot, product, { limit: 12 });
    assert.equal(
      hits.some((h) => h.entryCode === "ML1"),
      false,
    );
  });

  it("retains a precise single-term candidate", () => {
    const product = specsToProduct({
      name: "Magnetometers",
      techDescription: "Magnetometers",
    });

    const hits = retrieveControlListCandidates(snapshot, product, { limit: 12 });
    assert.ok(hits.some((hit) => hit.entryCode === "6A006"));
  });
});

describe("5A002 predicates", () => {
  it("flags key length above 56 bits", () => {
    const product = specsToProduct({
      name: "Crypto module",
      techDescription: "AES-256 encryption",
      specs: [{ key: "encryption", valueRaw: "256-bit AES", valueNum: 256, unit: "bit", confidence: 0.9 }],
    });

    const hits = runPredicates(product, ["5A002"]);
    assert.ok(hits.some((h) => h.outcome === "threshold_met"));
  });

  it("returns insufficient_data without key length", () => {
    const product = specsToProduct({
      name: "Encrypted appliance",
      techDescription: "VPN encryption for remote access",
    });

    const hits = runPredicates(product, ["5A002"]);
    assert.ok(hits.some((h) => h.outcome === "insufficient_data"));
  });
});

describe("classification confidence", () => {
  it("weights deterministic threshold hits", () => {
    const product = specsToProduct({
      name: "Crypto module",
      techDescription: "AES-256",
      specs: [{ key: "encryption", valueRaw: "256-bit", valueNum: 256, unit: "bit", confidence: 0.9 }],
    });
    const predicateHits = runPredicates(product, ["5A002"]);
    const low = computeClassificationConfidence({
      product,
      predicateHits: [],
      missingFields: ["end_user"],
    });
    const high = computeClassificationConfidence({
      product,
      predicateHits,
      missingFields: [],
    });
    assert.ok(high > low);
  });
});
