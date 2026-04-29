# TradeDNA — Active Plan

**Goal:** clean Trade Test resubmission of HS 02071290 / BR / CPC 4000 → DMSACC → DMSCLE.
**Started:** 2026-04-27 22:42
**Last updated:** 2026-04-28

---

## Stage 1 — Unblock the lane

**Target:** ~30 min total. Was 15 min, revised after discovering UI slot limit.

- [x] **1.1** Promote lane `kn7ber0a8tds7vs4kd936nv3f584x13h` from `minimal` → `enriched`
  - via `npx convex run declarations:backfillTransportAndMode '{"id":"kn…","mode":"enriched"}'`
  - confirmed: `applied: { mode: "enriched" }`
  - actual time: 1 min
- [ ] 👉 **1.2** Add 4 doc codes (D006, D028, D031, 360) to `goods_items.additionalDocuments[]`
  - **NOT** documents-upload. Engine reads from items array, not docs table. ([rule_engine.ts:246](convex/lib/rule_engine.ts#L246))
  - UI items page only has 6 slots; lane has 3 already used → can't fit 4 more via UI
  - **Decision needed:** A) CLI write all 7 entries via `updateItem` (30 sec) or B) extend UI slot rows (10 min)
  - estimate once decided: 1–10 min
- [ ] **1.3** Re-run dry-run on `/dashboard/declarations/.../submit`
  - estimate: 1 min
- [ ] **1.4** Confirm `success: true`, zero blocking failures
  - estimate: 1 min

**Exit criterion:** dry-run UI shows zero blocking actions for the BR lane.

**If 1.4 fails:** new failures = curated layer surfaced something else. Stop, read the failure list, decide whether to add curated rules or fix declaration data.

---

## Stage 2 — Controlled Trade Test resubmit

**Target:** 5 min our side + HMRC turnaround (DMSACC 1–30 min, DMSCLE minutes–hours).

- [ ] **2.1** Live submit (one-shot) — `/submit` page
- [ ] **2.2** Capture conversationId + MRN from response
- [ ] **2.3** DMSACC notification arrives via webhook
- [ ] **2.4** DMSCLE notification arrives via webhook
- [ ] **2.5** Update `documentation/HMRC/tdr-progress.md` with the result

**Success:** notification chain reads DMSACC → DMSCLE with no DMSREJ.

**If DMSREJ:** webhook auto-ingests fieldErrors as `enabled: false` curated proposals. Review in `rule_definitions`, promote what's real, fix data, retry.

---

## Stage 3 — Audit follow-ups (this week)

Ranked by audit severity. Do in order; don't bundle.

- [ ] **3.1 — CRITICAL** Mapper hardcodes `CustomsValuation.MethodCode = "1"` ([wco-mapper.ts:457-459](src/lib/wco-mapper.ts#L457-L459)). Read declaration's valuation method instead. ~30 min + dry-run regression.
- [ ] **3.2 — HIGH** Verify rule-engine `rule_definitions` read scope. Confirm bounded `.take()` or add one. ~15 min.
- [ ] **3.3 — HIGH** Verify `Connection-Method: WEB_APP_VIA_SERVER` header is actually sent. Grep call sites, confirm. ~10 min.
- [ ] **3.4 — MEDIUM** `saveWebhook` patches just-inserted notification row. Decide doctrine vs restructure. ~30 min.
- [ ] **3.5 — MEDIUM** Mapper hardcoded fallbacks (office, location, transport, incoterms). Per-field: fail-closed vs keep fallback. ~1 hour.

**Total Stage 3 estimate:** ~3 hours over the week.

---

## Stage 4 — Out of scope until 1–3 done

- TDR (Trader Dress Rehearsal) — not on it, not planning it yet
- Booking freight, duty payment, post-clearance amendments at scale
- Auto-ingest end-to-end against fresh DMSREJ in production (path wired, unproven)
- Tariff parser geo-area expansion beyond the 3 broad groups
- Inbound webhook deduplication
- Items page UI slot expansion (only if Stage 1 chose path A)

---

## Timeline (cumulative)

| Stage | Estimate | Cumulative | Status |
|-------|----------|------------|--------|
| 1.1 | 1 min | 1 min | ✅ done |
| 1.2 | 1–10 min | 2–11 min | ⏳ blocked on A/B decision |
| 1.3 | 1 min | 3–12 min | ⏳ |
| 1.4 | 1 min | 4–13 min | ⏳ |
| 2.1 | 30 sec | ~5–14 min | ⏳ |
| 2.2–2.4 | HMRC pace | + 1 min – 6 hrs | ⏳ |
| 2.5 | 2 min | + 2 min | ⏳ |
| 3.x | ~3 hrs spread | this week | ⏳ |

**Realistic best case:** Stage 1 + Stage 2 done by end of today if HMRC is fast, no new DMSREJ surprises.
**Realistic worst case:** another DMSREJ → 1–2 more curated/data iterations → 2–3 days.

---

## How we know we're truly done

- Stage 1: dry-run green for the BR lane
- Stage 2: DMSACC → DMSCLE chain captured, evidence stored, tdr-progress.md updated
- Stage 3: every item closed with a commit and a re-run dry-run that still passes
