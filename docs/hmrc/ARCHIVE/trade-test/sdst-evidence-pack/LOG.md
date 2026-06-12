# Sandbox test log

Add one row per controlled HMRC test. Copy **Conversation ID**, **MRN**, and **timestamp** into the ODT.

| Date (UTC) | Test | LRN | MRN | X-Conversation-ID | Outcome | Evidence folder |
|------------|------|-----|-----|-------------------|---------|-----------------|
| 2026-06-04 | Submit (fresh run, Trade Test v2.0) | FC-MQ031D1B | 26GB65EJN3BYSELAR9 | **c25b5658581e471a82022e43cd7e6ee2** (submit) | DMSACC `22:44:14Z`; CDS13000 advisory; DMSTAX — **no DMSCLE while Accepted** | `evidence/03-notifications/response-dmsacc-26GB65EJN3BYSELAR9.xml` |
| 2026-06-04 | Cancel (INV) | FC-MQ031D1B | 26GB65EJN3BYSELAR9 | **385cf335-9b53-40fd-8519-ce0eaa599761** | HTTP 202; **DMSINV** `23:53:57` UK; FC11 DMSCLE same second (noise) | `evidence/04-cancel/summary-26GB65EJN3BYSELAR9.md` |
| 2026-06-03 | Submit (Trade Test v2.0) | FC-MPYAJ7RN | 26GB63M1I0RQFCVAR4 | **68edb212-5c4a-4ef7-9223-f55630c5859e** | DMSACC `2026-06-03T16:38:33Z`, 0 errors; CDS13000 advisory; DMSTAX ×2 | `evidence/02-submit/`, `evidence/03-notifications/` |
| 2026-06-04 | Notifications (baseline MRN) | FC-MPYAJ7RN | 26GB63M1I0RQFCVAR4 | 68edb212-5c4a-4ef7-9223-f55630c5859e | DMSACC + DMSTAX; **no DMSCLE on accept-only** — see `TRADE-TEST-REALITY.md` | `evidence/03-notifications/scenario-1-happy-path.md` |
| | Dry-run preflight | TT-* (runner) | — | b3139925-9dd2-474f-8618-d813e60429f5 | Dry-run pass | `evidence/02-submit/scenario-summary.json` |
| 2026-06-04 | Cancel (INV) | FC-MPYAJ7RN | 26GB63M1I0RQFCVAR4 | **300b7819-dc9c-4bb3-8fc1-ebf6b4b15724** (cancel — not submit) | HTTP 202; DMSREJ CDS12015 (already cleared) | `evidence/04-cancel/` |
| 2026-06-04 | Cancel (INV) | CX-kn73a2v… | 26GB651QTZ00PLSAR3 | 5fb35d53-8622-43ff-8f3d-7752069c4803 | HTTP 202; DMSREJ CDS10001/10002 (Amendment, no ChangeReasonCode) | `evidence/04-cancel/response-dmsrej-26GB651QTZ00PLSAR3.xml` |
| 2026-06-04 | Cancel (INV) | CX-kn73a2v… | 26GB653JGABXY5ZAR6 | 7f5ab9ef-c52c-4b46-9232-133a287ae8ca | HTTP 202; DMSREJ CDS10001 on 06A (no Amendment) | |
| 2026-06-04 | Cancel (INV) | CX-kn73a2v… | 26GB65677OGFD9XAR2 | *(conv from UI)* | HTTP 202; DMSREJ CDS10001 03A/225 — missing Pointer 06A in AI | `reference-TT_IM011a_Cancellation.xml` |
| 2026-06-04 | Cancel (INV) | CX-kn73a2v… / FC-MPZUVPRD | 26GB656DZN0FE7LAR0 | 5a46d731-2020-4c95-810c-cc83b40d36a3 | HTTP 202; **DMSINV FC02** `18:56:06Z` + FC11 DMSCLE same second (not invalidation proof) | `evidence/04-cancel/` |
| 2026-06-05 | Amend (COR) | AM-kn7ce59… | 26GB65FDQ6Y57UGAR0 | 2508a2c1-da26-4331-9e10-25bb847b7ec7 | HTTP 202; **DMSINV** CDS13000 — import still accepted | `evidence/05-amend/` |
| 2026-06-05 | Amend (COR) | AM-kn7ce59… | 26GB65GDRKWYWW7AR8 | 8ae6ad6d-4743-4470-8923-341bf04d0413 | HTTP 202; **DMSINV** CDS13000 again — raise item value (e.g. 8000+) | `evidence/05-amend/` |
| 2026-06-05 | Submit | *(LRN from UI)* | 26GB664W3BLIFZFAR4 | *(submit conv)* | DMSACC + DMSTAX — **not cancelled**; ghost Cancelled badge = old notif on same declaration row (fixed: MRN filter) | |
| 2026-06-05 | Amend (COR) | AM-kn7ce59… / FC-MQ0TDTJA | 26GB664W3BLIFZFAR4 | 01382a81-5000-408f-9c99-5215852f5758 | HTTP 202 → **DMSRES FC07** `11:12:02Z`; **VersionID 2**; GBP 8000 | `evidence/05-amend/summary.md` |
| 2026-06-05 | File upload initiate | — | 26GB664W3BLIFZFAR4 | **e8aba099-acee-438e-be25-2d4c713b9d99** | HTTP 200; ref `218eaeb7-6639-408c-9907-328033abce6c` | `evidence/06-file-upload/` |
| 2026-06-06 | Amend (COR) | AM-kn7ce59… | 26GB67PH78363HRAR7 | 57efd48c-694e-418d-a903-75a245fc135b | HTTP 202 → **DMSINV** FC03 `14:00:26Z`; **CDS12015** @ 42A/D014 (MRN state not amendable — amended same second as submit). Route now sends X-Submitter-Identifier. Structural validation passed. | — |
| 2026-06-12 | Amend (COR) — SDST retest | FC-MQB2EYRG / AM-pavtfg1q…-03P1Y2 | 26GB6GDX92A21TIAR0 | **4a267b1b-b7e4-4ce8-b9cf-d4e2a3be5b6e** (amend) | HTTP 202 → **DMSRES FC07** `15:22:37Z`; VersionID 2; GBP 8000 | `evidence/05-amend/response-dmsres-26GB6GDX92A21TIAR0.xml` |
| 2026-06-12 | Status by MRN — SDST retest | *(submit LRN from UI)* | 26GB6GFBKLT2N0TAR6 | **1da7b09a-339a-4730-afa1-7c9cbaa43e32** | HTTP **200**, **ICS 14**; DMSACC `16:51:31Z` | `evidence/07-status-query/summary-retest-2026-06-12.md` |
| 2026-06-12 | Cancel (INV) — SDST retest | FC-MQB46PCA / CX-kn7fh999… | 26GB6GFOZ64AZ37AR9 | **521e8797-09cc-4f56-8caa-b0041fae6646** (cancel) | HTTP 202 → **DMSINV FC02** `16:02:42Z` | `evidence/04-cancel/response-dmsinv-26GB6GFOZ64AZ37AR9.xml` |
| 2026-06-04 | Status by MRN | — | 26GB63M1I0RQFCVAR4 | 2a9e80a9-1b65-4541-8077-73d2492357f4 | HTTP 200, ICS 22, ROE 6 | `evidence/07-status-query/` |
| | Pull notifications | | | | | `evidence/08-pull-notifications/` |

## Row template (copy for new tests)

```
| YYYY-MM-DD | <endpoint> | <LRN> | <MRN> | <conversation-id> | <DMS* / HTTP status> | evidence/XX-.../ |
```
