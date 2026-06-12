# CDS production checklist — Trade Test v2.0 → SDST ODT

**Purpose:** Complete and return **`CDS-Production-Checklist-v1.2-FILLED.odt`** to Software Developer Support.  
**API version in this pack:** Trade Test **Declarations v2.0** (sandbox).  
**TDR v1.0 evidence:** separate checklist — [`docs/hmrc/ACTIVE/tdr/CHECKLIST.md`](../../../ACTIVE/tdr/CHECKLIST.md).

Copy values from completed rows into `forms/CDS-Production-Checklist-v1.2-FILLED.odt`.  
Evidence files live in this pack only (`evidence/`).  
Regenerate ODT: `node test-evidence/fill-cds-odt.js` (LibreOffice closed).

**Legend:** `[x]` done · 🟡 in app, not in pack · `[ ]` open · `[-]` not applicable

**SDST:** Agne Bergelyte email **2026-04-01** — production subscriptions **1.0 (Beta)** + return CDS (+ S&S) checklists.  
**ODT return:** ✅ **Sent** — **awaiting reply**; Agne asked for **retest** (see below).  
**Active session:** [`SDST-RETEST-SESSION.md`](./SDST-RETEST-SESSION.md) — **Trade Test v2.0** (`NEXT_PUBLIC_HMRC_ENV=tdr` commented out).

---

## June 2026 SDST retest (why we switched back to TT v2)

| Item | Status | Notes |
|------|--------|-------|
| Amend on `/customs/declarations/amend` | ✅ | `26GB6GDX92A21TIAR0` DMSRES — `summary-retest-2026-06-12.md` |
| Cancel on `/customs/declarations/cancellation-requests` | ✅ | `26GB6GFOZ64AZ37AR9` DMSINV — `summary-retest-2026-06-12.md` |
| Status query HTTP 200 | ✅ | `26GB6GFBKLT2N0TAR6` ICS 14 — `summary-retest-2026-06-12.md` |
| Production application ID in ODT | ✅ | `00292df9-e2e6-4d66-9d28-7d79a2a931ba` |
| Production webhook URL | ✅ | Hub api-metadata 2026-06-12 + live GET challenge 200 |
| Resend FILLED.odt + email | 🟡 | ODT regenerated — send using `EMAIL-RESEND-2026-06-12.md` |

**Done in code (not evidence):** dedicated cancel/amend URLs; multi-conversation pull.

---

## CDS — Application & admin (`forms/CDS-Production-Checklist-v1.2-FILLED.odt`)

### §1 Application details → `evidence/01-application-details.md`

- [x] Organisation name — **Freightcode** (in ODT)
- [x] Sandbox application name + ID — **freightcode** / `b74874e9-957e-4a40-b426-0cde839f8a45`
- [x] Production application name — **freightcode**
- [x] Production application ID — `00292df9-e2e6-4d66-9d28-7d79a2a931ba` (Get production credentials URL)
- [x] Deployment model — **SaaS** (in ODT)
- [x] Notification model — **Push**; sandbox ngrok validated 2026-06-04
- [x] Production callback URL — `https://www.freightcode.co.uk/api/hmrc/webhooks/notify` (in ODT)

### §2 Rate limit

- [x] Selected **3 rps** (tick in ODT)

### §3 APIs in use

- [x] Customs Declarations API — tick + §4 evidence in ODT
- [x] Customs Declarations Information API — tick + §5.2 evidence in ODT
- [-] Customs Inventory Linking Exports — N/A (CDS-only product)
- [-] Bulk Data File List — N/A
- [x] Trade Test v2.0 evidence referenced in ODT (not TDR)

---

## CDS §4 — Customs Declarations API

| # | Endpoint | Status | Evidence folder / files |
|---|----------|--------|-------------------------|
| 4.1 | `POST /customs/declarations` (submit) | **[x]** | `evidence/02-submit/` — MRN `26GB63M1I0RQFCVAR4`, conv `68edb212-…` |
| 4.2 | `POST /customs/declarations/cancellation-requests` | ✅ | Retest: `26GB6GFOZ64AZ37AR9` DMSINV (2026-06-12) + June `26GB656DZN0FE7LAR0` |
| 4.3 | `POST /customs/declarations/file-upload` (initiate) | **[x]** | `evidence/06-file-upload/` — conv `e8aba099-…`, ref `218eaeb7-…` |
| 4.4 | `POST /customs/declarations/amend` | ✅ | Retest: `26GB6GDX92A21TIAR0` DMSRES — `summary-retest-2026-06-12.md` |
| 4.5 | `POST /customs/declarations/arrival-notification` | **[-]** | Out of product scope |

All §4 rows ticked **Yes** with Client ID / MRN / LRN / timestamp / conversation ID in **FILLED.odt**.

---

## CDS §5 — Notifications & information

### Push / pull notifications

- [x] Push webhook configured (Developer Hub)
- [x] DMSACC + DMSTAX observed (`evidence/03-notifications/`) — **§5 satisfied for Push**
- [-] Pull notifications API — **N/A for this return** (ODT §1: **Push**; push evidence archived; pull is fallback in product only, not declared on checklist)

### §5.2 Customs Declarations Information

| Endpoint | Status | Evidence |
|----------|--------|----------|
| `GET .../mrn/{mrn}/status` | ✅ | Retest: `26GB6GFBKLT2N0TAR6` ICS 14 (2026-06-12) + June `26GB63M1I0RQFCVAR4` ICS 22 |
| `GET .../ducr/{ducr}/status` | **[-]** | Not used |
| `GET .../ucr/{ucr}/status` | **[-]** | Not used |
| `GET .../inventory-reference/.../status` | **[-]** | Not used |

---

## CDS — Submit to SDST

- [x] `forms/CDS-Production-Checklist-v1.2-FILLED.odt` generated from **LOG.md** (`fill-cds-odt.js`)
- [x] LibreOffice review — all **5 pages** checked before send
- [x] Completed ODT emailed to **softwaredevelopersupport@service.hmrc.gov.uk** — **awaiting reply**
- [ ] SDST reply received (production credentials / follow-up questions)

---

## SS-GB — `forms/SS-GB-Production-Application-Checklist-v2.3.odt`

**Not submitted with this CDS return** — no ENS evidence yet. S&S Hub subscriptions **unsubscribed** 2026-06-12 for CDS-only sign-off; **future ENS phase planned** — do not ask SDST to permanently block S&S access.

- [-] §1–§6 ENS endpoints — N/A for this CDS ODT
- [-] Return SS-GB ODT to SDST — deferred until ENS product phase

---

## Engineering gates (not on ODT — track before prod cutover)

Reference only; detail in `docs/hmrc/ARCHIVE/trade-test/pre-tdr-checklist.md`.

- [x] Notification status precedence — `tests/h1/`
- [x] CDS file-upload route wired to real HMRC API (`main` `10e7486`)
- [x] Fetch timeout + rate limiter wired (`hmrc-fetch.ts`)
- ✅ Cancel / amend / status retest in app (2026-06-12) — ODT regenerated; email draft ready
- [x] Production webhook registered in HMRC Developer Hub for prod URL (api-metadata 2026-06-12)

---

## Quick progress

| CDS ODT sections | Status |
|------------------|--------|
| §1 Admin | **Done** in FILLED.odt |
| §2 Rate limit | **Done** — 3 rps |
| §3 APIs | **Done** — Declarations + Information |
| §4 Endpoints | **Done** — submit, cancel, upload, amend |
| §5.2 Status | **Done** — MRN status |
| Email SDST | **Sent** — awaiting reply |
| SDST reply | **Open** |

**Overall CDS pack readiness: ~98%** — ODT returned; blocked on SDST response.
