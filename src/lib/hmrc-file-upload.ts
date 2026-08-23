import { xmlEscape } from "./xml-utils";

/**
 * CDS §4.3 — POST /customs/declarations/file-upload (`hmrc:fileupload`).
 *
 * Source, retrieved 2026-08-23: Uploading supporting documents, HMRC Developer Hub
 * https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/uploading-supporting-documents.html
 *
 * Element rules taken from that page:
 *
 * | Element          | Requirement                                        |
 * |------------------|----------------------------------------------------|
 * | `DeclarationID`  | Mandatory. MRN format.                              |
 * | `FileGroupSize`  | Mandatory. The number of files in the request.      |
 * | `FileSequenceNo` | Mandatory, per file.                                |
 * | `DocumentType`   | **Optional.** No enumerated value list is published. |
 *
 * > "A maximum of 11 files may be initiated in a single request."
 *
 * One request covers the whole group and HMRC returns a separate `Reference`
 * and upload target per file, in `Files/File` order.
 */

/** HMRC: a maximum of 11 files may be initiated in a single request. */
export const HMRC_FILE_UPLOAD_MAX_GROUP = 11;

export interface FileUploadRequestFile {
  /** 1-based position within the group. */
  fileSequenceNo: number;
  /**
   * Optional per HMRC. Omitted from the XML when absent — see
   * `resolveDocumentType` in `hmrc-supporting-evidence.ts` for why an invented
   * value is worse than none.
   */
  documentType?: string;
}

export class FileUploadGroupError extends Error {}

/**
 * Build the initiate request for a group of files.
 *
 * `FileGroupSize` is derived from the list rather than passed in, so it can
 * never disagree with the number of `File` elements actually sent.
 */
export function buildFileUploadGroupRequestXml(args: {
  mrn: string;
  files: FileUploadRequestFile[];
}): string {
  const files = args.files;
  if (files.length === 0) {
    throw new FileUploadGroupError("A file upload request must contain at least one file.");
  }
  if (files.length > HMRC_FILE_UPLOAD_MAX_GROUP) {
    throw new FileUploadGroupError(
      `HMRC accepts at most ${HMRC_FILE_UPLOAD_MAX_GROUP} files in a single request; ${files.length} were given.`,
    );
  }

  const sequences = files.map((f) => f.fileSequenceNo);
  if (new Set(sequences).size !== sequences.length) {
    throw new FileUploadGroupError("FileSequenceNo must be unique within a group.");
  }
  if (sequences.some((n) => !Number.isInteger(n) || n < 1)) {
    throw new FileUploadGroupError("FileSequenceNo must be a positive integer.");
  }

  const fileXml = files
    .map((file) => {
      const documentType = String(file.documentType ?? "").trim();
      return [
        "    <hmrc:File>",
        `      <hmrc:FileSequenceNo>${file.fileSequenceNo}</hmrc:FileSequenceNo>`,
        // Optional element: omitted entirely rather than sent empty or guessed.
        ...(documentType
          ? [`      <hmrc:DocumentType>${xmlEscape(documentType)}</hmrc:DocumentType>`]
          : []),
        "    </hmrc:File>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<hmrc:FileUploadRequest xmlns:hmrc="hmrc:fileupload">
  <hmrc:DeclarationID>${xmlEscape(args.mrn)}</hmrc:DeclarationID>
  <hmrc:FileGroupSize>${files.length}</hmrc:FileGroupSize>
  <hmrc:Files>
${fileXml}
  </hmrc:Files>
</hmrc:FileUploadRequest>`;
}

/**
 * Single-file convenience wrapper.
 *
 * `documentType` is optional here too — a caller that has no reliable value
 * omits it rather than defaulting.
 */
export function buildFileUploadRequestXml(args: {
  mrn: string;
  documentType?: string;
  fileSequenceNo?: number;
  fileGroupSize?: number;
}): string {
  return buildFileUploadGroupRequestXml({
    mrn: args.mrn,
    files: [
      {
        fileSequenceNo: Math.max(1, args.fileSequenceNo ?? 1),
        documentType: args.documentType,
      },
    ],
  });
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

/** One `Files/File` entry from the initiate response. */
export interface ParsedFileUploadTarget extends ParsedFileUploadResponse {
  /**
   * Position in the response. HMRC returns targets in the order the files were
   * requested, which is what ties a target back to its `FileSequenceNo`.
   */
  index: number;
}

/**
 * Parse every file target from a CDS file-upload initiate response.
 *
 * The single-file parser below reads only the first `Reference` and `Href` in
 * the document, which silently returns the first file's target for every file
 * in a group. This walks the `File` elements instead.
 */
export function parseFileUploadResponseGroup(bodyText: string): ParsedFileUploadTarget[] {
  const targets: ParsedFileUploadTarget[] = [];
  const fileRegex = /<(?:[^>]*:)?File\b[^>]*>([\s\S]*?)<\/(?:[^>]*:)?File>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = fileRegex.exec(bodyText)) !== null) {
    const block = match[1];
    const fieldsMatch = block.match(/<(?:[^>]*:)?Fields>([\s\S]*?)<\/(?:[^>]*:)?Fields>/i);
    const fields = fieldsMatch ? parseFileUploadFieldsXml(fieldsMatch[1]) : {};
    targets.push({
      index,
      reference: readXmlTag(block, "Reference"),
      uploadHref: readXmlTag(block, "Href"),
      fields,
      hasUploadFields: Object.keys(fields).length > 0,
    });
    index += 1;
  }

  return targets;
}

/** Parse HMRC CDS file-upload initiate XML response (first file only). */
export function parseFileUploadResponse(bodyText: string): ParsedFileUploadResponse {
  const [first] = parseFileUploadResponseGroup(bodyText);
  if (first) {
    return {
      reference: first.reference,
      uploadHref: first.uploadHref,
      fields: first.fields,
      hasUploadFields: first.hasUploadFields,
    };
  }

  // No <File> wrapper — fall back to a flat scan so a malformed or trimmed
  // response is still readable rather than silently empty.
  const fieldsMatch = bodyText.match(/<(?:[^>]*:)?Fields>([\s\S]*?)<\/(?:[^>]*:)?Fields>/i);
  const fields = fieldsMatch ? parseFileUploadFieldsXml(fieldsMatch[1]) : {};
  return {
    reference: readXmlTag(bodyText, "Reference"),
    uploadHref: readXmlTag(bodyText, "Href"),
    fields,
    hasUploadFields: Object.keys(fields).length > 0,
  };
}
