import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";
import {
  parseSanctionsXml,
  parseDesignation,
  GOLDEN_UNIQUE_IDS,
} from "../../scripts/export-controls/lib/sanctions-list-parser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "../../scripts/export-controls/fixtures/uksl-sample.xml");

describe("UK Sanctions List parser", () => {
  it("parses a designation block with deduped fields", () => {
    const xml = fs.readFileSync(FIXTURE, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: true,
      trimValues: true,
      isArray: (name) =>
        name === "Designation" ||
        name === "Name" ||
        name === "Address" ||
        name === "Passport" ||
        name === "IMONumber",
    });
    const parsed = parser.parse(xml);
    const dataset = parseSanctionsXml(parsed);

    assert.equal(dataset.entityCount, 3);
    assert.ok(dataset.dateGenerated);

    const entity = dataset.entities.find((e) => e.uniqueId === "AFG0001");
    assert.ok(entity);
    assert.equal(entity.groupType, "entity");
    assert.ok(entity.names.length >= 2);
    assert.ok(entity.measures.includes("asset_freeze"));
    assert.ok(entity.addresses.length >= 1);

    const ship = dataset.entities.find((e) => e.uniqueId === "DPR0075");
    assert.ok(ship);
    assert.equal(ship.groupType, "ship");
    assert.ok(ship.identifiers.some((id) => id.type === "imo"));

    const individual = dataset.entities.find((e) => e.uniqueId === "TST0001");
    assert.ok(individual);
    assert.equal(individual.dobs.length, 2);
    assert.equal(individual.identifiers.filter((id) => id.type === "passport").length, 1);
  });

  it("parses live UKSL when run with network (optional)", async () => {
    if (process.env.SKIP_UKSL_NETWORK === "1") return;

    const res = await fetch("https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml");
    if (!res.ok) {
      console.warn("Skipping live UKSL test: fetch failed");
      return;
    }

    const xml = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: true,
      trimValues: true,
      isArray: (name) => name === "Designation" || name === "Name",
    });
    const dataset = parseSanctionsXml(parser.parse(xml));

    assert.ok(dataset.entityCount >= 6000);
    for (const id of GOLDEN_UNIQUE_IDS) {
      assert.ok(
        dataset.entities.some((e) => e.uniqueId === id),
        `missing golden id ${id}`,
      );
    }
  });
});

describe("parseDesignation unit", () => {
  it("returns null without uniqueId", () => {
    assert.equal(parseDesignation({}), null);
  });
});
