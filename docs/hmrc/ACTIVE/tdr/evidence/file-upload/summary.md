# TDR — File upload initiate

**Date:** 2026-06-13  
**Outcome:** Initiate **PASS** — S3 POST **expected fail** on localhost (CORS)

| Field | Value |
|-------|--------|
| MRN | `26GB6GFBKLT2N0TAR6` |
| Route | `POST /api/hmrc/documents/initiate` → HMRC `POST /customs/declarations/file-upload` |
| Env | `NEXT_PUBLIC_HMRC_ENV=tdr` |
| UI | Declaration → **5. Secure Upload** |

## Result

1. **Initiate succeeded** — app received S3 `href` + `fields` and attempted browser POST to Upscan.
2. **S3 step failed:** `Failed S3 POST blocked by missing CORS or network error: Failed to fetch`

Per HMRC CDS workflow, **initiate evidence (§4.3 / checklist #8) does not require completing the S3 upload**. Sandbox Upscan does not allow browser CORS from `localhost`; production host is unaffected.

## Optional

Paste `initiate` response JSON from Network tab → `response.json` (conversationId, uploadReference).
