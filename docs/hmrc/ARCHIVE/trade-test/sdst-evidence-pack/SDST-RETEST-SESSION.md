# SDST retest session — Trade Test v2.0 (June 2026)

**Why env was switched:** Agne (SDST) follow-up after first ODT return — retest **cancel** and **amend** on the **correct HMRC paths**, fix **production application ID** in ODT, fresh **status query**, confirm **production push URL**, clarify **S&S out of scope for this CDS return** (not a request to revoke future access).

**Env (current):** `HMRC_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_HMRC_ENV=tdr` **commented out** → Declarations **v2.0** (`application/vnd.hmrc.2.0+xml`). Restart Next.js after changes.

**Not this session:** TDR v1.0 evidence — see [`../../../ACTIVE/tdr/evidence/LOG.md`](../../../ACTIVE/tdr/evidence/LOG.md).

---

## Agne / SDST actions (from follow-up email)

| # | Action | Status |
|---|--------|--------|
| A | Production application ID in ODT | ✅ Left **blank** — credentials requested 2026-06-12; sandbox ID only in sandbox field |
| B | Confirm production push URL + auth token | ✅ Hub + live challenge 200; token matches `.env.local` |
| C | Retest **cancel** → `POST /customs/declarations/cancellation-requests` | ✅ `26GB6GFOZ64AZ37AR9` DMSINV |
| D | Retest **amend** → `POST /customs/declarations/amend` | ✅ `26GB6GDX92A21TIAR0` DMSRES — summaries in pack |
| E | Fresh **status query** HTTP **200** | ✅ `26GB6GFBKLT2N0TAR6` ICS 14 |
| F | S&S subscriptions | ✅ Unsubscribed in Hub (2026-06-12); **do not ask SDST to block** — future ENS phase |
| G | Regenerate + resend **`CDS-Production-Checklist-v1.2-FILLED.odt`** | 🟡 ODT ready — **you send** email |

**Code fixes (done before retest):**

- ✅ Cancel route → `/customs/declarations/cancellation-requests`
- ✅ Amend route → `/customs/declarations/amend`
- ✅ Multi-conversation notification pull (`declarationId`)

---

## This session — captured in app only

### Amend (dedicated endpoint) — 🟡 prove in pack

| Field | Value |
|-------|--------|
| Date | 2026-06-12 ~16:03–16:22 UTC |
| MRN | `26GB6GDX92A21TIAR0` |
| Amend LRN | `AM-pavtfg1qbbzrmyspb8n88gs5s-03P1Y2` |
| Amend conversation | `4a267b1b-b7e4-4ce8-b9cf-d4e2a3be5b6e` |
| Outcome | **DMSRES** — CDS Status **Amended (DMSRES)**; DMSTAX on timeline |

**Still to do for §4.4 retest proof:**

- [x] Export DMSRES raw XML → `response-dmsres-26GB6GDX92A21TIAR0.xml`
- [ ] Save amend request XML (Network tab or submissions table) → `request-26GB6GDX92A21TIAR0.xml` (optional)
- [ ] `evidence/05-amend/summary-retest-2026-06-12.md`
- [ ] Row in [`LOG.md`](./LOG.md)
- [ ] Update ODT §4.4 row (MRN, conv, timestamp) → `node test-evidence/fill-cds-odt.js`

### Cancel — ✅ done (2026-06-12)

| Field | Value |
|-------|--------|
| LRN | FC-MQB46PCA |
| MRN | 26GB6GFOZ64AZ37AR9 |
| Cancel conversation | 521e8797-09cc-4f56-8caa-b0041fae6646 |
| DMSINV | 17:02:42 UTC |
| Summary | `evidence/04-cancel/summary-retest-2026-06-12.md` |

- [x] Export DMSINV raw XML → `response-dmsinv-26GB6GFOZ64AZ37AR9.xml`
- [ ] Cancel request XML from Submissions panel → `request-retest-2026-06-12.xml` (optional)

### Status query — ✅ done (2026-06-12)

| Field | Value |
|-------|--------|
| MRN | `26GB6GFBKLT2N0TAR6` |
| HTTP | 200 |
| ICS | 14 |
| Conversation | `1da7b09a-339a-4730-afa1-7c9cbaa43e32` |
| Summary | `evidence/07-status-query/summary-retest-2026-06-12.md` |

- [x] Optional: Network JSON → `response-retest-2026-06-12.json`
- [x] 404 reason for SDST → `404-explanation-for-sdst.md` + `EMAIL-FOLLOWUP-CDI-404.md`
- SDST email: cite retest MRN for §5.2; **must include 404 reason** (TDR v1 vs TT v2 index)

---

## Recommended run order (one sitting)

```
1. Submit MRN-A  →  DMSACC  →  Status query HTTP 200  →  archive §5.2
2. Submit MRN-B  →  DMSACC  →  Cancel within 2 min  →  DMSINV FC02  →  archive §4.2
3. Archive amend evidence for 26GB6GDX92A21TIAR0 (already done in UI)  →  §4.4
4. Hub: copy production application ID  →  fix 01-application-details.md + ODT §1
5. node test-evidence/fill-cds-odt.js  →  LibreOffice review  →  email Agne
```

**Timing rule:** amend/cancel only while status is **Accepted**, before sandbox **DMSCLE** (~seconds–minutes).

---

## When SDST retest is complete

1. Mark this file items ✅
2. Update [`CHECKLIST.md`](./CHECKLIST.md) retest section
3. Comment stays: TT v2 for SDST; uncomment `NEXT_PUBLIC_HMRC_ENV=tdr` for TDR v1 amend/cancel **freeze** runs
