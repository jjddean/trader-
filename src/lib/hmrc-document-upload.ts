import {
  buildFileUploadGroupRequestXml,
  buildFileUploadRequestXml,
  parseFileUploadResponse,
  parseFileUploadResponseGroup,
  type ParsedFileUploadResponse,
} from "./hmrc-file-upload";

export const HMRC_DOCUMENT_MAX_BYTES =
  Number(process.env.HMRC_DOCUMENT_MAX_BYTES) || 10 * 1024 * 1024;

export interface PostFileToHmrcS3Result {
  ok: boolean;
  status: number;
  statusText: string;
}

/** POST file bytes to HMRC Upscan presigned S3 URL (server-side — no browser CORS). */
export async function postFileToHmrcS3(params: {
  href: string;
  fields: Record<string, string>;
  fileBytes: ArrayBuffer | Buffer;
  fileName: string;
  contentType?: string;
}): Promise<PostFileToHmrcS3Result> {
  const form = new FormData();
  for (const [key, value] of Object.entries(params.fields)) {
    form.append(key, value);
  }
  const blobPart: BlobPart =
    params.fileBytes instanceof Buffer
      ? Uint8Array.from(params.fileBytes)
      : new Uint8Array(params.fileBytes);
  const blob = new Blob([blobPart], {
    type: params.contentType || "application/pdf",
  });
  form.append("file", blob, params.fileName);

  const response = await fetch(params.href, {
    method: "POST",
    body: form,
  });

  return {
    ok: response.status === 201 || response.status === 204 || response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

export function parseInitiateResponse(bodyText: string): ParsedFileUploadResponse {
  return parseFileUploadResponse(bodyText);
}

export {
  buildFileUploadGroupRequestXml,
  buildFileUploadRequestXml,
  parseFileUploadResponse,
  parseFileUploadResponseGroup,
};
