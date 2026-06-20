# TDR v1 evidence log

Authoritative record of sandbox tests (`Accept: application/vnd.hmrc.1.0+xml`).  
Add one row per new test. Store XML under this folder.

**Environment:** `HMRC_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_HMRC_ENV=tdr` — see [`../environment-matrix.md`](../environment-matrix.md)

| Date (UTC) | Test | LRN | MRN | X-Conversation-ID | Outcome | Files |
|------------|------|-----|-----|---------------------|---------|-------|
| 2026-06-10 20:15 | Submit FC9 | FC-MQ8IDIYS | 26GB6DTVT5133M7AR0 | c493713d-b599-421c-8283-f182a1e7d275 | DMSACC | `submit/`, `passing-payload.xml` |
| 2026-06-13 19:20 | Amend | AM-zqmrw49eqhnpwtz95kh88kxqx-V5SU4Y | 26GB6HZPT2QN2U8AR7 | 18ab42e9-9f26-4648-9b9f-de35d8b1e4c1 | DMSRES | `amend/` |
| 2026-06-13 19:38 | Cancel | CX-kn78tw6ms6bdnjvp4r1mdnz7v188j528 | 26GB6I2VFHAN3WAAR0 | 4646aa3d-48ac-4654-aef2-646c806d3c33 | DMSINV | `cancel/` |
| 2026-06-13 20:40 | Status query | — | 26GB6I2VFHAN3WAAR0 | — | CDS60001 | `status-query/` |
| 2026-06-13 | Pull notifications | — | 26GB6I2VFHAN3WAAR0 | 2 convs | HTTP 200 | `pull-notifications/` |
| 2026-06-13 | File upload | — | 26GB6GFBKLT2N0TAR6 | — | Initiate OK | `file-upload/` |
| 2026-06-18 | File upload (server S3) | — | — | — | Route shipped — retest on Vercel | `file-upload/summary.md` |
| 2026-06-08 | File upload UI E2E (initiate + S3) | — | 26GB6MJW33LM8NNAR6 | 54060ee7-cc1b-450c-b398-32998a03c941 | PASS — `Jason_Dean.pdf`, ref `dc7e6551-8918-42fe-8b89-ee995399f03d` | `file-upload/summary.md` |

**Row template:** `| YYYY-MM-DD | test | LRN | MRN | conversation-id | outcome | folder/ |`

---

## Production / HMRC ops (not sandbox tests)

| Date | Event | Ref | Outcome |
|------|-------|-----|---------|
| 2026-06-15 | Developer Hub email verified | freightcode app | Production credentials unlocked (sign in to Hub) |
| 2026-06-15 | SDST production application approved | Agne Bergelyte, SDST | Approved; S&S + Pull Notifications removed from prod app |
| 2026-06-15 | Production push URL submitted | SDST | `https://www.freightcode.co.uk/api/hmrc/webhooks/notify` |
| 2026-06-08 | Connect HMRC OAuth fixed (local) | [`../oauth-connect-troubleshooting.md`](../oauth-connect-troubleshooting.md) | Redirect URI + `test-www` authorize + `test-api` token + PKCE + `localhost:3000` host alignment |

**Production push URL:** `https://www.freightcode.co.uk/api/hmrc/webhooks/notify`  
**Production application ID:** `00292df9-e2e6-4d66-9d28-7d79a2a931ba`

