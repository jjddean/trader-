# TDR checklist — Customs Declarations v1.0 (Beta)

**Purpose:** Track **TDR v1** sandbox evidence (`NEXT_PUBLIC_HMRC_ENV=tdr`, `Accept: application/vnd.hmrc.1.0+xml`).  
**Not the same as:** CDS production ODT — see [`../../ARCHIVE/trade-test/sdst-evidence-pack/CHECKLIST.md`](../../ARCHIVE/trade-test/sdst-evidence-pack/CHECKLIST.md).

**SDST context:** Production app **freightcode** subscriptions set to **1.0 (Beta)** — email from Agne Bergelyte, **2026-04-01**.  
**Evidence:** TDR v1 DMSACC frozen — `FC-MQ8IDIYS` / `26GB6DTVT5133M7AR0` (2026-06-10).

**Legend:** ✅ done · 🟡 app proven / freeze pending · `[ ]` open · `[-]` not applicable

---

## Environment (must match for every TDR test)

- ✅ `HMRC_ENVIRONMENT=sandbox`
- ✅ `NEXT_PUBLIC_HMRC_ENV=tdr` (uncomment in `.env.local`; restart Next.js)
- ✅ Submit host: `https://test-api.service.hmrc.gov.uk/customs/declarations`
- ✅ Accept: `application/vnd.hmrc.1.0+xml`
- ✅ Each evidence file records: **Accept header**, **X-Conversation-ID**, **timestamp** (submit pack)

**Note:** SDST retest sessions may temporarily use **Trade Test v2.0** (`NEXT_PUBLIC_HMRC_ENV` commented out). App outcomes on v2 do **not** count as TDR v1 evidence until re-run with v1 headers and frozen under `evidence/`.

---

## TDR evidence — `docs/hmrc/ACTIVE/tdr/evidence/`

| # | Flow | Status | Target proof |
|---|------|--------|----------------|
| 1 | Submit (FC9) | ✅ | DMSACC, 0 blocking errors — `FC-MQ8IDIYS` / `26GB6DTVT5133M7AR0` |
| 2 | Frozen passing XML | ✅ | `evidence/passing-payload.xml` |
| 3 | Amend | 🟡 | DMSRES on v1 — folder `evidence/amend/` |
| 4 | Cancel | [ ] | DMSINV FC02 on v1 — folder `evidence/cancel/` |
| 5 | Push notifications | 🟡 | DMSACC raw XML in `evidence/notifications/`; production URL confirmed for SDST |
| 6 | Pull notifications | 🟡 | App pulls all conversations per declaration; unpulled artifact still `[ ]` |
| 7 | Status query | 🟡 | CLI probe `evidence/status-query/cli-test-2026-06-11.json` — TDR MRNs 404; need fresh HTTP 200 on v1 |
| 8 | File upload initiate | [ ] | SDE presigned fields — `evidence/file-upload/` |
| 9 | DMSREJ log | ✅ | Row in [`errors-handled.md`](./errors-handled.md) |

---

## Item 3 — Amend (freeze still required)

**App validated (Trade Test v2.0, 2026-06-12)** — not yet TDR v1 frozen:

| Field | Value |
|-------|--------|
| MRN | `26GB6GDX92A21TIAR0` |
| Submit | ~16:03 UTC |
| Amend | ~16:13 UTC (value amend, COR / TT_IM002b) |
| Amend LRN | `AM-pavtfg1qbbzrmyspb8n88gs5s-03P1Y2` |
| X-Conversation-ID (amend) | `4a267b1b-b7e4-4ce8-b9cf-d4e2a3be5b6e` |
| Outcome | **DMSRES** — CDS Status **Amended (DMSRES)**; DMSTAX on timeline |
| Sandbox note | DMSCLE follows quickly — further amend/cancel on same MRN → CDS12015 |

**To close item 3 (✅):**

- [ ] Re-run with `NEXT_PUBLIC_HMRC_ENV=tdr` + `Accept: application/vnd.hmrc.1.0+xml`
- [ ] Amend within **1–2 min** of DMSACC (before sandbox DMSCLE)
- [ ] Save `evidence/amend/request.xml`, `response-dmsres.xml`, `summary.md`
- [ ] Add row to [`evidence/LOG.md`](./evidence/LOG.md)
- [ ] Export DMSRES raw XML from Status timeline → evidence folder

---

## Item 6 — Pull notifications (app, 2026-06-12)

- ✅ Pull route accepts `declarationId` — all submit/amend/cancel conversations
- ✅ Status page **Pull notifications** uses declaration-scoped pull
- ✅ Scheduled pulls (`scheduleNotificationPulls`) multi-conversation per declaration
- ✅ Timeline merges MRN-indexed rows after amend overwrites `conversationId`
- [ ] Capture HMRC unpulled list + retrieve response → `evidence/pull-notifications/`

---

## Submit proof (item 1 + 2) — done

- ✅ Log DMSACC in [`errors-handled.md`](./errors-handled.md)
- ✅ Save request XML → `evidence/submit/request.xml`
- ✅ Save DMSACC notification → `evidence/submit/response-dmsacc.xml`
- ✅ Copy accepted request → `evidence/passing-payload.xml`
- ✅ Add row to `evidence/LOG.md` (LRN, MRN, conversation ID, UTC)

---

## Regression

- 🟡 `npm run test:h1` — notification collection tests pass (run before TDR freeze)
- [ ] Dry-run scenario passes with **TDR** env (`NEXT_PUBLIC_HMRC_ENV=tdr`)
- [ ] Golden XML diff vs `passing-payload.xml` (when frozen)

---

## Relationship to CDS ODT

| Checklist | API version | Evidence home | Return to SDST? |
|-----------|-------------|---------------|-----------------|
| **CDS** (archive pack) | Trade Test **v2.0** + ODT fields | `ARCHIVE/trade-test/sdst-evidence-pack/` | **Yes** — email `CDS-Production-Checklist-v1.2-FILLED.odt` |
| **TDR** (this file) | **v1.0 (Beta)** | `ACTIVE/tdr/evidence/` | **No ODT yet** — build pack; cite when SDST ask for v1 parity |

SDST enabled **1.0 Beta** on production app **2026-04-01**. CDS ODT proves **v2.0** sandbox tests. TDR checklist proves **v1.0** — both may be needed.

**Code fixes for SDST retest (v2 session, 2026-06-11/12):**

- ✅ Amend → `POST /customs/declarations/amend` (was wrongly posting to submit URL)
- ✅ Cancel → `POST /customs/declarations/cancellation-requests`
- ✅ Amend XML — dual `AdditionalInformation` + DE 4/11 co-amend (AES blocks)

---

## Timeline

| Date | Event |
|------|--------|
| 2026-04-01 | SDST email — production subscriptions **1.0 Beta** + checklists attached |
| 2026-06-03–05 | Trade Test v2 evidence completed (CDS ODT source) |
| 2026-06-10 | TDR v1 DMSACC `FC-MQ8IDIYS` — evidence frozen in `ACTIVE/tdr/evidence/` |
| 2026-06-11 | Amend endpoint path fix; CDS12015 rows on stale MRNs in `errors-handled.md` |
| 2026-06-12 | **DMSRES** on `26GB6GDX92A21TIAR0` (TT v2 UI) — amend path validated; TDR v1 freeze pending |
| 2026-06-12 | Multi-conversation notification pull + timeline MRN merge shipped |
| — | CDS ODT emailed to SDST — **awaiting reply** |
| **Next** | TDR v1 amend/cancel freeze runs; fresh status query HTTP 200 |

---

*Update rows when evidence lands. Move items to ✅ in [`DELIVERY-PLAN.md`](./DELIVERY-PLAN.md) when done.*
