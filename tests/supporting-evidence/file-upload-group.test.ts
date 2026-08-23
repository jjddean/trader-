/**
 * Grouped file-upload initiation.
 *
 * Source, retrieved 2026-08-23: Uploading supporting documents, HMRC Developer Hub
 * https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/uploading-supporting-documents.html
 *
 * > "A maximum of 11 files may be initiated in a single request."
 *
 * DocumentType is documented as optional with no enumerated value list.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFileUploadGroupRequestXml,
  buildFileUploadRequestXml,
  FileUploadGroupError,
  HMRC_FILE_UPLOAD_MAX_GROUP,
  parseFileUploadResponse,
  parseFileUploadResponseGroup,
} from "../../src/lib/hmrc-file-upload";

const MRN = "26GB664W3BLIFZFAR4";

/** Counts opening `<hmrc:Tag>` elements, ignoring any attributes on them. */
function countTag(xml: string, tag: string): number {
  return [...xml.matchAll(new RegExp("<hmrc:" + tag + "(?![\\w])[^>]*>", "g"))].length;
}

function groupResponse(references: string[]): string {
  const files = references
    .map(
      (reference, i) => `<File>
        <Reference>${reference}</Reference>
        <UploadRequest>
          <Href>https://bucket-${i}.s3.amazonaws.com</Href>
          <Fields>
            <key>key-${i}</key>
            <policy>policy-${i}</policy>
          </Fields>
        </UploadRequest>
      </File>`,
    )
    .join("\n");
  return `<FileUploadResponse xmlns="hmrc:fileupload"><Files>${files}</Files></FileUploadResponse>`;
}

describe("grouped initiate request", () => {
  it("sends three files as one request with FileGroupSize 3", () => {
    const xml = buildFileUploadGroupRequestXml({
      mrn: MRN,
      files: [{ fileSequenceNo: 1 }, { fileSequenceNo: 2 }, { fileSequenceNo: 3 }],
    });
    // One request: a single FileUploadRequest and a single Files wrapper.
    assert.equal(countTag(xml, "FileUploadRequest"), 1);
    assert.equal(countTag(xml, "Files"), 1);
    assert.match(xml, /<hmrc:FileGroupSize>3<\/hmrc:FileGroupSize>/);
    assert.equal(countTag(xml, "File"), 3);
  });

  it("numbers the files 1, 2, 3", () => {
    const xml = buildFileUploadGroupRequestXml({
      mrn: MRN,
      files: [{ fileSequenceNo: 1 }, { fileSequenceNo: 2 }, { fileSequenceNo: 3 }],
    });
    assert.deepEqual(
      [...xml.matchAll(/<hmrc:FileSequenceNo>(\d+)<\/hmrc:FileSequenceNo>/g)].map((m) => m[1]),
      ["1", "2", "3"],
    );
  });

  it("derives FileGroupSize from the file list so the two cannot disagree", () => {
    for (const n of [1, 2, 5, 11]) {
      const xml = buildFileUploadGroupRequestXml({
        mrn: MRN,
        files: Array.from({ length: n }, (_, i) => ({ fileSequenceNo: i + 1 })),
      });
      assert.match(xml, new RegExp(`<hmrc:FileGroupSize>${n}</hmrc:FileGroupSize>`));
      assert.equal(countTag(xml, "File"), n);
    }
  });

  it("accepts eleven files as one group", () => {
    assert.equal(HMRC_FILE_UPLOAD_MAX_GROUP, 11);
    const xml = buildFileUploadGroupRequestXml({
      mrn: MRN,
      files: Array.from({ length: 11 }, (_, i) => ({ fileSequenceNo: i + 1 })),
    });
    assert.match(xml, /<hmrc:FileGroupSize>11<\/hmrc:FileGroupSize>/);
    assert.equal(countTag(xml, "FileUploadRequest"), 1);
  });

  it("rejects a twelfth file rather than truncating or splitting silently", () => {
    assert.throws(
      () =>
        buildFileUploadGroupRequestXml({
          mrn: MRN,
          files: Array.from({ length: 12 }, (_, i) => ({ fileSequenceNo: i + 1 })),
        }),
      (error: unknown) => error instanceof FileUploadGroupError && /at most 11/.test(String(error)),
    );
  });

  it("rejects an empty group", () => {
    assert.throws(
      () => buildFileUploadGroupRequestXml({ mrn: MRN, files: [] }),
      FileUploadGroupError,
    );
  });

  it("rejects duplicate sequence numbers", () => {
    assert.throws(
      () =>
        buildFileUploadGroupRequestXml({
          mrn: MRN,
          files: [{ fileSequenceNo: 1 }, { fileSequenceNo: 1 }],
        }),
      (error: unknown) => error instanceof FileUploadGroupError && /unique/.test(String(error)),
    );
  });

  it("rejects a non-positive sequence number", () => {
    assert.throws(
      () => buildFileUploadGroupRequestXml({ mrn: MRN, files: [{ fileSequenceNo: 0 }] }),
      FileUploadGroupError,
    );
  });

  it("still builds a valid single-file request", () => {
    const xml = buildFileUploadRequestXml({ mrn: MRN, documentType: "Licence" });
    assert.match(xml, /xmlns:hmrc="hmrc:fileupload"/);
    assert.match(xml, new RegExp(`<hmrc:DeclarationID>${MRN}</hmrc:DeclarationID>`));
    assert.match(xml, /<hmrc:FileGroupSize>1<\/hmrc:FileGroupSize>/);
    assert.match(xml, /<hmrc:FileSequenceNo>1<\/hmrc:FileSequenceNo>/);
    assert.match(xml, /<hmrc:DocumentType>Licence<\/hmrc:DocumentType>/);
  });
});

describe("DocumentType", () => {
  it("is omitted entirely when no reliable value exists", () => {
    const xml = buildFileUploadGroupRequestXml({ mrn: MRN, files: [{ fileSequenceNo: 1 }] });
    // Optional per HMRC; an empty element or a guessed one would both be worse.
    assert.ok(!xml.includes("DocumentType"));
  });

  it("is never defaulted to invoice", () => {
    const xml = buildFileUploadGroupRequestXml({
      mrn: MRN,
      files: [{ fileSequenceNo: 1 }, { fileSequenceNo: 2 }],
    });
    assert.ok(!/invoice/i.test(xml));
  });

  it("is omitted for a blank or whitespace value", () => {
    const xml = buildFileUploadGroupRequestXml({
      mrn: MRN,
      files: [{ fileSequenceNo: 1, documentType: "   " }],
    });
    assert.ok(!xml.includes("DocumentType"));
  });

  it("is set per file, not per group", () => {
    const xml = buildFileUploadGroupRequestXml({
      mrn: MRN,
      files: [
        { fileSequenceNo: 1, documentType: "Commercial invoice" },
        { fileSequenceNo: 2 },
        { fileSequenceNo: 3, documentType: "Certificate of origin" },
      ],
    });
    assert.equal(countTag(xml, "DocumentType"), 2);
    assert.match(xml, /<hmrc:DocumentType>Commercial invoice<\/hmrc:DocumentType>/);
    assert.match(xml, /<hmrc:DocumentType>Certificate of origin<\/hmrc:DocumentType>/);
  });

  it("escapes the value", () => {
    const xml = buildFileUploadGroupRequestXml({
      mrn: MRN,
      files: [{ fileSequenceNo: 1, documentType: "Invoice & packing <list>" }],
    });
    assert.match(xml, /Invoice &amp; packing &lt;list&gt;/);
  });
});

describe("grouped initiate response", () => {
  it("returns one target per file, in request order", () => {
    const targets = parseFileUploadResponseGroup(groupResponse(["ref-a", "ref-b", "ref-c"]));
    assert.equal(targets.length, 3);
    assert.deepEqual(
      targets.map((t) => t.reference),
      ["ref-a", "ref-b", "ref-c"],
    );
    assert.deepEqual(
      targets.map((t) => t.index),
      [0, 1, 2],
    );
  });

  it("gives each file its own upload target and fields", () => {
    // The single-file parser reads the first Href in the document, which would
    // have posted every file in a group to file one's target.
    const targets = parseFileUploadResponseGroup(groupResponse(["ref-a", "ref-b"]));
    assert.equal(targets[0].uploadHref, "https://bucket-0.s3.amazonaws.com");
    assert.equal(targets[1].uploadHref, "https://bucket-1.s3.amazonaws.com");
    assert.equal(targets[0].fields.key, "key-0");
    assert.equal(targets[1].fields.key, "key-1");
    assert.notEqual(targets[0].uploadHref, targets[1].uploadHref);
  });

  it("correlates a returned reference to the file that requested it", () => {
    const files = [
      { fileSequenceNo: 1, name: "invoice.pdf" },
      { fileSequenceNo: 2, name: "origin.pdf" },
      { fileSequenceNo: 3, name: "licence.pdf" },
    ];
    const targets = parseFileUploadResponseGroup(groupResponse(["ref-1", "ref-2", "ref-3"]));
    const paired = files.map((f) => ({
      name: f.name,
      reference: targets[f.fileSequenceNo - 1].reference,
    }));
    assert.deepEqual(paired, [
      { name: "invoice.pdf", reference: "ref-1" },
      { name: "origin.pdf", reference: "ref-2" },
      { name: "licence.pdf", reference: "ref-3" },
    ]);
  });

  it("flags a target with no upload metadata", () => {
    const broken = `<FileUploadResponse xmlns="hmrc:fileupload"><Files>
      <File><Reference>ref-a</Reference></File>
    </Files></FileUploadResponse>`;
    const [target] = parseFileUploadResponseGroup(broken);
    assert.equal(target.hasUploadFields, false);
    assert.equal(target.uploadHref, null);
  });

  it("returns nothing for a response with no File elements", () => {
    assert.deepEqual(parseFileUploadResponseGroup("<FileUploadResponse/>"), []);
  });

  it("keeps the single-file parser working on a single-file response", () => {
    const parsed = parseFileUploadResponse(groupResponse(["ref-only"]));
    assert.equal(parsed.reference, "ref-only");
    assert.equal(parsed.uploadHref, "https://bucket-0.s3.amazonaws.com");
    assert.equal(parsed.hasUploadFields, true);
  });

  it("single-file parser returns the first file of a group, not a merge", () => {
    const parsed = parseFileUploadResponse(groupResponse(["ref-a", "ref-b"]));
    assert.equal(parsed.reference, "ref-a");
    assert.equal(parsed.uploadHref, "https://bucket-0.s3.amazonaws.com");
  });
});

describe("per-file outcomes", () => {
  /** Mirrors how the route folds S3 results into a group response. */
  function summarise(results: Array<{ success: boolean }>) {
    const sent = results.filter((r) => r.success).length;
    return { success: sent === results.length, sent, failed: results.length - sent };
  }

  it("does not report a group as sent when one file failed", () => {
    const summary = summarise([{ success: true }, { success: false }, { success: true }]);
    assert.equal(summary.success, false);
    assert.equal(summary.sent, 2);
    assert.equal(summary.failed, 1);
  });

  it("reports success only when every file landed", () => {
    assert.equal(summarise([{ success: true }, { success: true }]).success, true);
  });

  it("reports a single-file failure as a failure", () => {
    assert.equal(summarise([{ success: false }]).success, false);
  });
});
