import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFileUploadRequestXml,
  parseFileUploadResponse,
} from "../../src/lib/hmrc-file-upload";

describe("HMRC CDS file upload", () => {
  it("builds hmrc:fileupload request with Files wrapper", () => {
    const xml = buildFileUploadRequestXml({
      mrn: "26GB664W3BLIFZFAR4",
      documentType: "invoice",
    });
    assert.match(xml, /xmlns:hmrc="hmrc:fileupload"/);
    assert.match(xml, /<hmrc:DeclarationID>26GB664W3BLIFZFAR4<\/hmrc:DeclarationID>/);
    assert.match(xml, /<hmrc:Files>/);
    assert.match(xml, /<hmrc:DocumentType>invoice<\/hmrc:DocumentType>/);
  });

  it("parses initiate response Href, Reference, and S3 Fields", () => {
    const sample = `<FileUploadResponse xmlns="hmrc:fileupload">
      <Files><File>
        <Reference>218eaeb7-6639-408c-9907-328033abce6c</Reference>
        <UploadRequest>
          <Href>https://example.s3.amazonaws.com</Href>
          <Fields>
            <key>218eaeb7-6639-408c-9907-328033abce6c</key>
            <policy>abc</policy>
          </Fields>
        </UploadRequest>
      </File></Files>
    </FileUploadResponse>`;
    const parsed = parseFileUploadResponse(sample);
    assert.equal(parsed.reference, "218eaeb7-6639-408c-9907-328033abce6c");
    assert.equal(parsed.uploadHref, "https://example.s3.amazonaws.com");
    assert.equal(parsed.fields.key, "218eaeb7-6639-408c-9907-328033abce6c");
    assert.equal(parsed.fields.policy, "abc");
    assert.equal(parsed.hasUploadFields, true);
  });
});
