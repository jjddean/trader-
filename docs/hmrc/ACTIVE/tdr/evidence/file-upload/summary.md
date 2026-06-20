# TDR — File upload initiate + S3 (server-side)

**Date:** 2026-06-08 (UI E2E pass) · 2026-06-18 (route implementation)  
**Outcome:** **PASS (local UI)** — initiate + S3 via `POST /api/hmrc/documents/upload`

| Field | Value |
|-------|--------|
| MRN (UI E2E 2026-06-08) | `26GB6MJW33LM8NNAR6` |
| File | `Jason_Dean.pdf` (35,173 bytes) |
| X-Conversation-ID | `54060ee7-cc1b-450c-b398-32998a03c941` |
| Upload reference | `dc7e6551-8918-42fe-8b89-ee995399f03d` |
| Declaration ID | `kn78tw6ms6bdnjvp4r1mdnz7v188j528` |
| Initiate (2026-06-13) | PASS (MRN `26GB6GFBKLT2N0TAR6`) |
| S3 browser POST (localhost) | FAIL — CORS (expected) |
| S3 server POST | **PASS** — `POST /api/hmrc/documents/upload` |
| Evidence JSON | `ui-e2e-2026-06-08.json` |
| CLI retest | `npm run test:file-upload-s3` |

## Change (2026-06-18)

Browser uploads previously called Upscan S3 directly → blocked by CORS on `localhost` (and some origins).

**Fix:** single server route uploads on behalf of the user:

1. `POST /api/hmrc/documents/upload` (multipart: `declarationId`, `file`)
2. Server initiates HMRC file-upload → POSTs file to presigned S3 URL
3. UI (`declarations/[id]/documents`) uses this route only

Same code path on **Vercel** (`freightcode.co.uk`) — no browser CORS to Upscan.

## Retest on Vercel

1. Deploy branch to Vercel (includes new upload route).
2. Run `npx convex dev` locally (or deploy) so `resolveAccessToken` is on cloud.
3. Sign in → open declaration with **MRN** → **Secure Upload** → upload a small PDF.
4. Expect success banner; check Network tab: only `/api/hmrc/documents/upload` (no direct S3 from browser).

**CLI (sandbox, no browser):**

```bash
# After convex deploy + HMRC connected
npm run test:file-upload-s3

# Or one-off with a fresh sandbox token:
HMRC_ACCESS_TOKEN=<token> MRN=<mrn> npm run test:file-upload-s3
```

Writes `s3-result.json` + updates this file when CLI passes.

## Files

| File | Purpose |
|------|---------|
| `initiate-request.xml` | Last HMRC initiate request |
| `initiate-response.xml` | Last HMRC initiate response |
| `s3-result.json` | Initiate + S3 status summary (CLI) |
| `ui-e2e-2026-06-08.json` | Local UI upload pass (Jason_Dean.pdf) |
| `summary.md` | This file |
