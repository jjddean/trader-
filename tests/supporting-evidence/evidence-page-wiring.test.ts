/**
 * Structural checks on the Secure Upload page and its API route.
 *
 * The repo has no React renderer (vitest runs edge-runtime for the portal
 * only), so these assert the wiring at source level rather than rendering.
 * They are deliberately narrow: each one names a behaviour that would
 * regress silently — a query dropped, a default reintroduced, a group split
 * back into per-file requests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const PAGE = readFileSync("src/app/dashboard/declarations/[id]/documents/page.tsx", "utf8");
const UPLOAD_ROUTE = readFileSync("src/app/api/hmrc/documents/upload/route.ts", "utf8");
const INITIATE_ROUTE = readFileSync("src/app/api/hmrc/documents/initiate/route.ts", "utf8");

describe("evidence page — DMSDOC drives the UI", () => {
  it("reads the documentary request rather than showing a blank uploader", () => {
    assert.match(PAGE, /api\.supporting_evidence\.getDocumentaryRequest/);
  });

  it("shows the requested documents with their codes and descriptions", () => {
    assert.match(PAGE, /statementCode/);
    assert.match(PAGE, /HMRC documentary check/);
  });

  it("tells the user when nothing on the declaration matches a request", () => {
    assert.match(PAGE, /No matching document on this declaration/);
  });

  it("shows what is already held against a matched request", () => {
    assert.match(PAGE, /heldFileName/);
  });

  it("lets a file be attached per requested document", () => {
    assert.match(PAGE, /Attach file/);
    assert.match(PAGE, /setLineFile/);
  });

  it("keeps proactive upload when there is no documentary check", () => {
    // HMRC: "An authenticated trader may use the service at any time."
    assert.match(PAGE, /HMRC has not raised a documentary check/);
    assert.match(PAGE, /hasRequest \?/);
  });

  it("sends the attached files as one group", () => {
    assert.match(PAGE, /Send selected documents to HMRC/);
    assert.match(PAGE, /as one group/);
  });

  it("reports per-file outcomes rather than one group verdict", () => {
    assert.match(PAGE, /sent successfully/);
    assert.match(PAGE, /outcome\?\.success/);
  });

  it("records only the files HMRC accepted", () => {
    assert.match(PAGE, /if \(!result\.success\) continue;/);
  });

  it("carries the group position and the answered request code into the record", () => {
    assert.match(PAGE, /fileSequenceNo: result\.fileSequenceNo/);
    assert.match(PAGE, /fileGroupSize: data\.fileGroupSize/);
    assert.match(PAGE, /requestedStatementCode/);
  });

  it("shows each sent file's HMRC reference", () => {
    assert.match(PAGE, /hmrcUploadReference/);
  });
});

describe("upload route — one initiate per group", () => {
  it("accepts multiple files", () => {
    assert.match(UPLOAD_ROUTE, /formData\.getAll\("file"\)/);
  });

  it("builds a single grouped initiate request", () => {
    assert.match(UPLOAD_ROUTE, /buildFileUploadGroupRequestXml/);
    // One fetchHmrc call to the file-upload endpoint, not one per file.
    assert.equal(UPLOAD_ROUTE.split("customs/declarations/file-upload").length - 1, 1);
    assert.equal(UPLOAD_ROUTE.split("await fetchHmrc(").length - 1, 1);
  });

  it("parses a target per file", () => {
    assert.match(UPLOAD_ROUTE, /parseFileUploadResponseGroup/);
  });

  it("refuses the group when HMRC returns the wrong number of targets", () => {
    assert.match(UPLOAD_ROUTE, /upload targets for/);
  });

  it("rejects more than eleven files with the limit named", () => {
    assert.match(UPLOAD_ROUTE, /HMRC_FILE_UPLOAD_MAX_GROUP/);
    assert.match(UPLOAD_ROUTE, /smaller batches/);
  });

  it("returns 207 when part of a group failed", () => {
    assert.match(UPLOAD_ROUTE, /status: sent === results\.length \? 200 : 207/);
  });
});

describe("DocumentType is no longer hardcoded", () => {
  /** Matches a literal fallback in code, ignoring prose in comments. */
  function hasLiteralDefault(source: string): boolean {
    return source
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .some((line) => /(\?\?|\|\|)\s*"[A-Za-z]/.test(line) && /documentType|docType/i.test(line));
  }

  it("is gone from the upload route", () => {
    assert.equal(hasLiteralDefault(UPLOAD_ROUTE), false);
    assert.ok(!/documentType \|\| "invoice"/.test(UPLOAD_ROUTE));
  });

  it("is gone from the initiate route", () => {
    assert.equal(hasLiteralDefault(INITIATE_ROUTE), false);
    assert.ok(!/: *"invoice"/.test(INITIATE_ROUTE));
  });

  it("is derived through the shared resolver in both routes", () => {
    assert.match(UPLOAD_ROUTE, /resolveDocumentType/);
    assert.match(INITIATE_ROUTE, /resolveDocumentType/);
  });

  it("is never populated from a CDS DE 2/3 document code", () => {
    // The file-upload spec defines no such mapping; DE 2/3 codes belong on the
    // declaration. The route passes the request description, not the code.
    assert.match(UPLOAD_ROUTE, /requestDescription: requestDescriptions\[index\]/);
    assert.ok(!/documentType: *statementCode/.test(UPLOAD_ROUTE));
  });
});
