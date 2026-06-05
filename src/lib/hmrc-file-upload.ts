import { xmlEscape } from "./xml-utils";

/** CDS §4.3 — POST /customs/declarations/file-upload request shape (hmrc:fileupload). */
export function buildFileUploadRequestXml(args: {
  mrn: string;
  documentType: string;
  fileSequenceNo?: number;
  fileGroupSize?: number;
}): string {
  const seq = Math.max(1, args.fileSequenceNo ?? 1);
  const groupSize = Math.max(1, args.fileGroupSize ?? 1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<hmrc:FileUploadRequest xmlns:hmrc="hmrc:fileupload">
  <hmrc:DeclarationID>${xmlEscape(args.mrn)}</hmrc:DeclarationID>
  <hmrc:FileGroupSize>${groupSize}</hmrc:FileGroupSize>
  <hmrc:Files>
    <hmrc:File>
      <hmrc:FileSequenceNo>${seq}</hmrc:FileSequenceNo>
      <hmrc:DocumentType>${xmlEscape(args.documentType)}</hmrc:DocumentType>
    </hmrc:File>
  </hmrc:Files>
</hmrc:FileUploadRequest>`;
}

function readXmlTag(bodyText: string, name: string): string | null {
  const match = bodyText.match(
    new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`),
  );
  return match?.[1]?.trim() ?? null;
}

/** Parse Fields block from CDS file-upload initiate response into S3 form key/value pairs. */
export function parseFileUploadFieldsXml(fieldsBlock: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const tagPattern = /<([^>/\s]+)>([^<]*)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(fieldsBlock)) !== null) {
    const rawName = match[1];
    const localName = rawName.includes(":") ? rawName.split(":").pop()! : rawName;
    fields[localName] = match[2];
  }
  return fields;
}

export interface ParsedFileUploadResponse {
  reference: string | null;
  uploadHref: string | null;
  fields: Record<string, string>;
  hasUploadFields: boolean;
}

/** Parse HMRC CDS file-upload initiate XML response. */
export function parseFileUploadResponse(bodyText: string): ParsedFileUploadResponse {
  const reference = readXmlTag(bodyText, "Reference");
  const uploadHref = readXmlTag(bodyText, "Href");
  const fieldsMatch = bodyText.match(/<(?:[^>]*:)?Fields>([\s\S]*?)<\/(?:[^>]*:)?Fields>/i);
  const fields = fieldsMatch ? parseFileUploadFieldsXml(fieldsMatch[1]) : {};

  return {
    reference,
    uploadHref,
    fields,
    hasUploadFields: Object.keys(fields).length > 0,
  };
}
