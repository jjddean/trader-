# File upload initiate — how to capture evidence

**Checklist:** [CHECKLIST.md](../../CHECKLIST.md) §4.3  
**Endpoint:** `POST /customs/declarations/file-upload` (Customs Declarations API v2.0)

This is **not** the SDE route (`/logistics/documents/initiate`). The ODT tick requires the CDS file-upload initiate call.

## Prerequisites

- HMRC connected in app Settings (OAuth token in Convex)
- `.env.local`: `HMRC_TEST_USER_ID`, `NEXT_PUBLIC_CONVEX_URL`, `HMRC_CLIENT_ID`, `HMRC_CLIENT_SECRET`
- An **Accepted** sandbox MRN (default: `26GB664W3BLIFZFAR4` from amend evidence)

## CLI (recommended)

```bash
node test-evidence/initiate-file-upload.js
```

Optional overrides:

```bash
MRN=26GB664W3BLIFZFAR4 DOCUMENT_TYPE=invoice node test-evidence/initiate-file-upload.js
```

On success the script writes:

| File | Content |
|------|---------|
| `request.xml` | `FileUploadRequest` payload |
| `response.xml` | HMRC response (`FileUploadResponse` with S3 `Href` + `Fields`) |
| `summary.md` | HTTP status, conversation ID, upload reference |

## Pass criteria

- HTTP **200** (OAS success)
- Response contains `FileUploadResponse` with at least one `UploadRequest` / `Href` (signed S3 URL metadata)
- `X-Conversation-ID` present in response headers

You do **not** need to complete the multipart S3 upload for SDST §4.3 — initiate evidence is enough.

## Log

Add a row in [LOG.md](../../LOG.md), e.g.:

```
| 2026-06-05 | File upload initiate | — | 26GB664W3BLIFZFAR4 | <conv-id> | HTTP 200, upload ref | evidence/06-file-upload/ |
```

Tick §4.3 in [CHECKLIST.md](../../CHECKLIST.md).

## Request shape

From HMRC [CDS E2E file upload guide](https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/uploading-supporting-documents.html):

```xml
<hmrc:FileUploadRequest xmlns:hmrc="hmrc:fileupload">
  <hmrc:DeclarationID>{MRN}</hmrc:DeclarationID>
  <hmrc:FileGroupSize>1</hmrc:FileGroupSize>
  <hmrc:Files>
    <hmrc:File>
      <hmrc:FileSequenceNo>1</hmrc:FileSequenceNo>
      <hmrc:DocumentType>invoice</hmrc:DocumentType>
    </hmrc:File>
  </hmrc:Files>
</hmrc:FileUploadRequest>
```

Headers: `Accept: application/vnd.hmrc.2.0+xml`, `Content-Type: application/xml; charset=UTF-8`, `X-Eori-Identifier` (declarant EORI).

## If it fails

| Symptom | Action |
|---------|--------|
| `No HMRC token` | Reconnect HMRC in Settings |
| `Missing EORI` | Reconnect HMRC or set `HMRC_EORI` in `.env.local` |
| HTTP 400 `BAD_REQUEST` | Check MRN exists and is Accepted; inspect `response.xml` |
| HTTP 401 | Token expired — reconnect HMRC, re-run |
| HTTP 403 `PAYLOAD_FORBIDDEN` | WAF — check fraud headers / filename rules in request |

## Not in scope for this evidence

- `/logistics/documents/initiate` (Secure Document Environment) — separate API, used by `/api/hmrc/documents/initiate`
- Multipart POST to S3 (step 2 of upload workflow) — optional follow-up, not required for ODT §4.3
