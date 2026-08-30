import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CATALOGUE_SOURCE_URL,
  HMRC_FUNCTION_CODE_TO_DMS,
  dmsTypeFromFunctionCode,
  extractFunctionCode,
  presentationForDmsType,
  resolveHmrcDmsType,
} from "../../convex/lib/hmrc_notification_catalogue";

/** Official table from HMRC Receiving notifications (fetched 2026-08-28). */
const HMRC_OFFICIAL: Record<string, string> = {
  "01": "DMSACC",
  "02": "DMSRCV",
  "03": "DMSREJ",
  "05": "DMSCTL",
  "06": "DMSDOC",
  "07": "DMSRES",
  "08": "DMSROG",
  "09": "DMSCLE",
  "10": "DMSINV",
  "11": "DMSREQ",
  "13": "DMSTAX",
  "14": "DMSCPI",
  "15": "DMSCPR",
  "16": "DMSEOG",
  "17": "DMSEXT",
  "18": "DMSGER",
  "50": "DMSALV",
  "51": "DMSQRY",
};

describe("HMRC notification catalogue", () => {
  it("matches the official FunctionCode table", () => {
    assert.equal(
      CATALOGUE_SOURCE_URL,
      "https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/notifications.html",
    );
    for (const [code, dms] of Object.entries(HMRC_OFFICIAL)) {
      assert.equal(HMRC_FUNCTION_CODE_TO_DMS[code], dms, `FC ${code}`);
      assert.equal(dmsTypeFromFunctionCode(code), dms);
    }
    assert.equal(HMRC_FUNCTION_CODE_TO_DMS["04"], undefined);
  });

  it("does not rename FunctionCode 02 from payload or stored type", () => {
    const xml = `<Response><FunctionCode>02</FunctionCode><FunctionalError/><Declaration><FunctionalReferenceID>CX-abc123def456</FunctionalReferenceID></Declaration></Response>`;
    assert.equal(extractFunctionCode(xml), "02");
    assert.equal(resolveHmrcDmsType({ rawPayload: xml, storedNotificationType: "DMSINV" }), "DMSRCV");
    const p = presentationForDmsType("DMSRCV");
    assert.equal(p.badgeLabel, "Received by HMRC (DMSRCV)");
    assert.doesNotMatch(p.badgeLabel, /DMSACC|DMSINV/);
  });
});

describe("no duplicate FunctionCode maps", () => {
  it("keeps FUNCTION_CODE_TO_DMS only in the catalogue module", () => {
    const roots = ["src", "convex"];
    const hits: string[] = [];
    function walk(dir: string) {
      const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          if (name === "node_modules" || name === ".next") continue;
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        if (p.replace(/\\/g, "/").endsWith("convex/lib/hmrc_notification_catalogue.ts")) continue;
        const text = readFileSync(p, "utf8");
        if (/FUNCTION_CODE_MAP/.test(text)) hits.push(p);
        if (/"02"\s*:\s*"DMSINV"/.test(text)) hits.push(p);
      }
    }
    for (const root of roots) walk(join(process.cwd(), root));
    assert.deepEqual(hits, []);
  });
});
