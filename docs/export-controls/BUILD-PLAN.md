# FreightCode Export Controls Module — Build Plan

**Status:** ACTIVE — 67 of 128 items ticked (checked 2026-08-19). Also holds the verified regulatory facts in §0  
**Created:** 2026-07-03  
**Last updated:** 2026-07-12 (§Consultant loop — no Settings roster / multi-pick)
**Scope:** UK export-control LITE draft packs — decision-support and draft-generation only. FreightCode never submits to government systems and never gives binding legal advice.

---

## 0. Verified facts (web-checked 2026-07-03)

These are the regulatory facts the module is built on. Re-verify before any go-live.

| Fact | Verified detail | Source |
|------|----------------|--------|
| UK control list version | Consolidated list last updated **16 Dec 2025** via Export Control (Amendment) (No. 2) Regulations 2025 (SI 2025/1197, in force 16 Dec 2025) | [GOV.UK consolidated list](https://www.gov.uk/government/publications/uk-strategic-export-control-lists-the-consolidated-list-of-strategic-military-and-dual-use-items-that-require-export-authorisation) · [SI 2025/1197](https://www.legislation.gov.uk/uksi/2025/1197/body/made) |
| Control list legal status | Reproduced control text is informational, **no force in law** → outputs are always "recommendation + evidence", never a determination | GOV.UK consolidated list page |
| Sanctions single source | Since **28 Jan 2026 09:00** the FCDO **UK Sanctions List (UKSL)** is the ONLY source. OFSI Consolidated List is closed. Use UKSL `Unique ID`, not OFSI Group ID, for new designations | [Single-list guidance](https://www.gov.uk/guidance/moving-to-a-single-list-for-uk-sanctions-designations-28-january-2026) |
| UKSL machine formats | 7 formats at **static URLs**: XML `https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml`, also `.csv`, `.txt`, `.ods`, `.odt`, HTML, PDF. XSD schema published (v4.33.3). List actively updated (last update seen 26 Jun 2026) | [UKSL publication](https://www.gov.uk/government/publications/the-uk-sanctions-list) · [Format guide](https://www.gov.uk/guidance/format-guide-for-the-uk-sanctions-list) |
| LITE service scope | "Apply to export controlled goods" (LITE) covers **SIEL + F680** only. Browser-based, GOV.UK One Login. **No public submission API exists** → manual copy-paste handoff is the only integration | [Apply to export controlled goods](https://www.gov.uk/guidance/apply-to-export-controlled-goods) |
| SPIRE exceptions (current) | Must use SPIRE (processed by **OTSI**) for exports/ancillary services to: **Belarus, Burma (Myanmar), Iran, Iraq, Lebanon, Libya, North Korea, Russia, Syria, Venezuela, Zimbabwe**. Also SPIRE for control entries: **2D352, 3D006, 3E003h** (software), **8A002o4** (marine), **9E003a2e, 9E003k** (technology), torture-goods Annex II 1.1–1.4/2.1–2.8/3.1–3.2/4.1–4.2, Annex III 1.1–1.3/2.1–2.3/3.1–3.6, Annex IV 1.1. Transhipment (SITL) and all non-SIEL licence types also remain on SPIRE | [SIEL guidance](https://www.gov.uk/guidance/standard-individual-export-licences-siels) |
| SIEL processing | ECJU **target**: 70% in 20 working days, 99% in 60. 2024 actual: 60% in 20 days, median 16 days. Sanctioned/sensitive destinations take significantly longer. Clock pauses on RFIs. **Never present as a guarantee** | [ECJU service code](https://www.gov.uk/government/publications/service-and-performance-code-for-export-licensing/ecju-service-and-performance-code) |
| NI jurisdiction | Recast EU Dual-Use Regulation 2021/821 applies in Northern Ireland; GB uses assimilated Regulation 428/2009 as amended. Routing logic must include **origin jurisdiction (GB vs NI)**, not just destination | Control list intro · SI 2025/1197 explanatory note |
| Terminology | UK output is a **"control entry" / "rating"** — never label it "ECCN" in the UK flow | GOV.UK consolidated list page |

### Corrections vs the original research doc

- [x] SPIRE exception list replaced with the current GOV.UK version (sanctioned destinations + specific entry table) — the "Category 0 / radioactive sources" framing was outdated.
- [x] Stack proposal (FastAPI / PostgreSQL / pgvector / Celery) **discarded** — everything maps onto the existing FreightCode stack: Next.js API routes, Convex, Cloudflare R2, Textract, Groq/Cloudagent. See §1.
- [x] **Typesense not used** — search is R2 JSON + edge/in-memory lexical retrieval (see §1). Existing Typesense infra in repo is unused for this module.
- [x] "20 days later: SIEL approved" messaging banned. UI copy: "ECJU aims to decide 70% of SIELs within 20 working days; sensitive destinations take longer."
- [x] UI must say "Open official GOV.UK SIEL service" / "This case must be submitted in SPIRE" — never "Submit to LITE".

---

## 1. Architecture decisions (final)

Export Controls is a **module inside FreightCode**, not a new app. It reuses the existing job/declaration, document, AI, and audit infrastructure.

| Concern | Decision | Why |
|---------|----------|-----|
| Case model | New `export_assessments` Convex table linked to `declarations` (optional link — an assessment can exist standalone) | Reuses clients, docs, audit; matches existing patterns |
| Control list data | Parsed entries as **versioned JSON in R2** (`export-controls/control-list/v2025-12-16.json`) with a `referenceDatasets` pointer. **Never in Convex** (>1,000 rows rule) | `.cursorrules` #1, #7 |
| Control list search | **R2 JSON + edge/in-memory lexical search** — fetch versioned dataset via CDN, BM25/token-overlap + exact entry-code match in TypeScript (`src/lib/export-controls/retrieval.ts`). Category-scoped fetch for <100ms lookups | No Typesense dependency; `.cursorrules` #8 |
| Sanctions data | Daily ingest of UKSL XML → normalized JSON in **R2** (`export-controls/sanctions/v{date}.json`). Fuzzy name matching via deterministic TS (trigram/token overlap) over in-memory index loaded from R2. Version metadata only in Convex | `.cursorrules` #1, #7 |
| Deterministic rules | **Hardcoded TypeScript** in `src/lib/export-controls/` — threshold predicates, SPIRE/OTSI routing table, NI jurisdiction logic. Never AI-generated | `.cursorrules` #2, #3 |
| AI role | Groq/Cloudagent for **extraction** (specs, end user, end use from documents) and **explanation** of deterministic results. AI proposes candidate entries; it never clears or finalises | `.cursorrules` #3, #13 |
| Screening authority | Deterministic scoring pipeline; probabilistic only in candidate generation (token/trigram overlap) with fixed thresholds. Human confirms all hits | Research plan, kept |
| GOV.UK handoff | Draft pack with per-field copy buttons → "Open official GOV.UK service" link → user records application/licence reference back in FreightCode | No public API exists |
| Expert review | Build on the existing (schema-only) `declaration_approvals` pattern → new `expert_requests` table + queue UI | Reuse sign-off shape |
| Audit | Existing `auditLogs` table + version-pinning on every classification run (control-list version, sanctions version, prompt version, model) | `.cursorrules` #12, existing infra |
| Document audit backend | In-repo `POST /api/export-controls/audit` — heuristic audit + optional Groq extraction; persists via `documents.recordDocumentAudit` | Replaces external `localhost:9500` dependency |

### Three terminal states (hard rule)

- **CLEAR** — no control match, no destination issue, no sanctions hit, high extraction confidence. Only state that can be reached automatically, and only when zero edge conditions.
- **FLAGGED** — likely controlled, sanctions hit ≥0.80, or SPIRE/OTSI destination.
- **REVIEW REQUIRED** — ambiguity, missing discriminators, weak sanctions similarity (0.65–0.80), NI edge case, or any SPIRE-exception control entry.

---

## 2. What already exists (verified in codebase 2026-07-03)

- [x] `/dashboard/trade-compliance` page shell with tabs (Document Audit, Overview, Assessments, Templates, Datasets, Reports) — `src/app/dashboard/trade-compliance/page.tsx`
- [x] Document Audit panel: upload → Convex storage → Textract OCR (`/api/ai/extract`) — `src/components/trade-compliance/document-audit-panel.tsx`
- [x] Textract + Groq invoice extraction (commodity code, description, origin, value) — `src/app/api/ai/extract/route.ts`
- [x] Smart upload + document classification via Cloudagent — `src/app/api/ai/smart-upload/route.ts`, `cloudagent/src/index.ts`
- [x] R2 + `referenceDatasets` versioned pointer pattern — `convex/actions/currency.ts`, `src/hooks/useReferenceData.ts`
- [x] Rule engine pattern (`rule_definitions`, `validation_results`) from CDS pre-submission validation
- [x] Audit log infra (`auditLogs`, `convex/audit.ts`, `src/lib/audit-log.ts`)
- [x] Declaration detail page with step tabs — `src/app/dashboard/declarations/[id]/layout.tsx`
- [x] AI chat assistant with declaration context — `src/app/api/ai/chat/route.ts`
- [x] `declaration_approvals` + `financial_exposures` schema (sign-off shape; no code yet)
- [x] UK control list PDF in repo — `docs/export-controls/sources/uk_export_control_list_2025-12-16.pdf`
- [x] HS code lookup (Trade Tariff API + static cache) — pattern to mirror for control entries
- [x] Control list parser + golden tests — `scripts/export-controls/`, `tests/export-controls/`
- [x] UK Sanctions List ingest + R2 upload — `scripts/export-controls/ingest-sanctions-list.mjs`, 6,263 designations

- [x] Export-facts extraction + document audit API — `src/app/api/export-controls/extract`, `src/app/api/export-controls/audit`, `src/lib/export-controls/extraction.ts`, `document-audit.ts`
- [x] Document Audit panel wired to in-repo audit route + Convex persistence — `document-audit-panel.tsx`, `documents.recordDocumentAudit`

**Mock / not built:** Assessments UI still mock, Overview KPIs, Sanctions/Licences tabs, Draft Pack, SPIRE/OTSI routing, screening engine. See **§3 Return-to log** — open items stay open even if we start Phase 4.

---

## 3. Return-to log (do not lose when changing phases)

**Rule:** Moving to Phase 4 (or any later phase) does **not** close earlier phases. Checkboxes marked `[x]` mean **that slice is built**, not “nothing left to do in this phase.” Every open row below must be revisited and ticked **Complete when** before calling the phase done.

**Agent rule:** Before starting a new phase, append any skipped work here. Never mark a phase “complete” in chat — say **“core shipped; return-to log has N open items.”**

| ID | Item | From | Status | Complete when |
|----|------|------|--------|---------------|
| RT-01 | Full OCR fixture tests (scanned PDF, superscripts) | 2 | open | Redacted PDFs in `tests/export-controls/fixtures/` + test passes **or** signed manual QA note |
| RT-02 | Groq extraction integration test (live OCR path) | 2 | open | Skipped-when-no-key CI test **or** manual QA on uploaded invoice |
| RT-03 | Document Audit → Classify on extracted products | 2→3 | open | Audit persist creates/links assessment; “Classify products” calls `/api/export-controls/classify` on real extraction (not demo-only) |
| RT-04 | Classification review UI (approve/reject per product) | 3 | open | Real assessment detail shows runs from Convex; human can set `finalControlEntry` via `reviewClassificationRun` |
| RT-05 | Cat 3 electronics + ML predicate pack | 3 | open | Predicates in `src/lib/export-controls/predicates/` + golden tests for each |
| RT-06 | Labelled case corpus from human overrides | 3→8 | open | Review UI writes overrides; export path for Phase 8 rule compiler |
| RT-07 | Classify tab uses demo product only | 3 | open | Resolved by RT-03 or removed once audit path works |
| RT-08 | Daily UKSL cron + failure alerting | 4 | **deferred → go-live** | Manual ingest + upload works today; partial cron (hash/stale check) enough while building. Full auto ingest→R2→`recordVersion` + alerting when Phases 5–9 done and Phase 10 go-live prep starts |
| RT-09 | Wire `isSnapshotFresh` into screening / CLEAR gate | 4 | partial | Screen route returns freshness + blocks auto-clear; full CLEAR gate in Phase 10 |
| RT-13 | Sanctions confirm/dismiss screening UI | 4 | open | UI calls `reviewSanctionsScreening` with justification; logged to audit |
| RT-10 | Assessments / Overview / Sanctions / Licences mock UI | 9 | open | Tabs read from `export_assessments` etc.; kill `TC-2026-00184` hardcode |
| RT-11 | SPIRE/OTSI routing + draft pack + expert queue | 5–7 | open | Respective phase deliverables + tests |
| RT-12 | LoRA / fine-tuned control-entry model | — | **deferred → Phase 8+** | See §ML/LoRA. Not for compliance determinism; optional recall/explanation assist after ≥200 reviewed cases (RT-06). Existing `lora-dataset/` is HS-side only |

### Phase closure gates (all return-to rows for that phase must be done)

| Phase | Core shipped? | Phase fully closed? |
|-------|---------------|---------------------|
| 1 | Yes | Yes |
| 2 | Yes | **No** — RT-01, RT-02, RT-03 open |
| 3 | Yes (demo Classify tab verified in app) | **No** — RT-03, RT-04, RT-05, RT-06, RT-07 open |
| 4 | Yes (demo Sanctions tab + screen API) | **No** — RT-08 partial, RT-09 partial, confirm/dismiss UI open |
| 5+ | No | No |

---

## Phase 1 — Data foundations (control list + sanctions ingestion)

The two datasets everything else depends on. No UI in this phase.

### 1a. Control list ingestion

- [x] Parse `docs/export-controls/sources/uk_export_control_list_2025-12-16.pdf` into structured entries — `scripts/export-controls/parse-control-list.mjs` → **480 entries** (22 military, 431 dual-use, 12 firearms, 15 radioactive)
- [x] Chunk **by entry and clause** — `chunks[]` per entry with lettered sub-clauses (`5A002` → 39 chunks); threshold text kept intact within clause chunks
- [x] Upload versioned JSON to R2: `export-controls/control-list/v2025-12-16.json` + `latest.json` — uploaded 2026-07-03
- [x] Register pointer in `convex/seed_reference_data.ts` — `export_control_list` → `/export-controls/control-list/latest.json`
- [x] Seed `referenceDatasets` row in Convex — `seedInitialDatasets` run 2026-07-03
- [x] Golden tests: 17 known entries (ML1, 5A002, 3A001, 2D352, etc.) — `npm run test:export-controls`
- [x] Update procedure documented below

**Commands:**
```bash
npm run export-controls:parse    # PDF → data/export-controls/v2025-12-16.json (~2.7 MB)
npm run export-controls:upload   # JSON → R2 (versioned + latest)
npm run test:export-controls     # golden entry verification
```

**Control list update procedure (when ECJU publishes a new list):**
1. Download new PDF from [GOV.UK consolidated list](https://www.gov.uk/government/publications/uk-strategic-export-control-lists-the-consolidated-list-of-strategic-military-and-dual-use-items-that-require-export-authorisation) → save to `docs/export-controls/sources/uk_export_control_list_{YYYY-MM-DD}.pdf`
2. Run `node scripts/export-controls/parse-control-list.mjs --pdf docs/export-controls/sources/uk_export_control_list_{date}.pdf --out data/export-controls/v{date}.json`
3. Run `npm run test:export-controls` — fix parser if golden entries fail
4. Run `npm run export-controls:upload -- --file data/export-controls/v{date}.json`
5. Update `referenceDatasets` row: new version string + verify `storagePath` still points at `latest.json`
6. Re-verify SPIRE exception table in Phase 5 routing against updated GOV.UK guidance
7. Log change in audit + bump `controlListVersion` on any in-flight assessments

### 1b. UK Sanctions List ingestion

- [x] Fetch UKSL XML from static URL `https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml` — **6,263 designations** (full set; earlier ~12.5k figure was counting `<DesignationSource>` tags)
- [x] Normalize to slim JSON: `uniqueId`, regime, names + aliases, non-Latin scripts, addresses, DOBs, passport/IMO/business-reg identifiers (deduped), measures, statement of reasons — `scripts/export-controls/lib/sanctions-list-parser.mjs`
- [x] Upload versioned snapshot to R2: `export-controls/sanctions/v2026-06-26.json` + `latest.json` (~12.3 MB)
- [x] `sanctions_versions` Convex table + `recordVersion` / `getLatestVersion` / `isSnapshotFresh` (48h guard query ready for Phase 4)
- [x] Snapshot loader types — `src/lib/export-controls/sanctions/snapshot.ts`
- [x] Golden tests (fixture + live UKSL) — `tests/export-controls/sanctions-list-parse.test.mjs`

**Commands:**
```bash
npm run export-controls:ingest-sanctions
npm run export-controls:upload-sanctions
npm run test:export-controls
```

### 1c. Convex schema additions

- [x] `export_assessments` — `convex/schema.ts` + CRUD in `convex/export_controls.ts`
- [x] `export_products` — linked to assessment, specs sub-table
- [x] `export_product_specs` — source page/quote/confidence fields
- [x] `export_classification_runs` — immutable append-only via `recordClassificationRun`
- [x] `sanctions_screenings` — `recordSanctionsScreening` + `reviewSanctionsScreening`
- [x] `expert_requests` — `createExpertRequest` with frozen snapshot
- [x] `export_licences` — `recordExportLicence` for post-GOV.UK reference capture
- [x] Auth pattern — `getUserIdentity()` + `canAccessAssessment` / org tenant scoping + audit log on key actions

---

## Phase 2 — Extraction extension (reuse OCR/AI pipeline)

- [x] Export-facts extraction pass (facts only, no classification) — `src/lib/export-controls/extraction.ts` + prompt v1
- [x] Spec anchoring: `sourcePage`, `sourceQuote`, `confidence` on every spec
- [x] Unit recogniser pre-pass — `src/lib/export-controls/units.ts`
- [x] `POST /api/export-controls/extract` — Textract + Groq + optional persist via `persistExtraction`
- [x] Input sanitisation — `src/lib/export-controls/sanitize.ts`
- [x] Document Audit wired to `POST /api/export-controls/audit` — persists via `documents.recordDocumentAudit`
- [x] Unit + audit heuristic tests — `tests/export-controls/extraction-units.test.ts`
- [ ] Full OCR fixture tests — **return-to RT-01**

**Phase 2:** core shipped · phase **not closed** (see §3 RT-01–RT-03)

## Phase 3 — Classification engine (candidates + human review)

AI proposes, deterministic layer constrains, human decides. No auto-clear in this phase.

- [x] Retrieval: R2 control-list JSON + in-memory lexical search — `src/lib/export-controls/retrieval.ts`, `control-list.ts`
- [x] Pass 2 prompt: map facts → candidate control entries — `src/lib/export-controls/classification.ts` (`export-classify-v1`)
- [x] Deterministic threshold predicates (initial): **5A002 crypto** — `src/lib/export-controls/predicates/`
- [x] Confidence model — `src/lib/export-controls/confidence.ts`
- [x] Classification run persistence — `POST /api/export-controls/classify` → `recordClassificationRun`
- [x] In-app test UI — **Classify** tab on `/dashboard/trade-compliance` (`export-classification-panel.tsx`)
- [x] Per-product feedback (loading + no-candidates result) — makes every **Classify** action visible
- [ ] Review UI: approve/reject per product — **return-to RT-04**
- [ ] Labelled data from human overrides — **return-to RT-06**
- [x] Golden tests: retrieval + predicates + confidence — `tests/export-controls/retrieval.test.ts`
- [ ] Document Audit → Classify on real extraction — **return-to RT-03, RT-07**

**Phase 3:** core shipped (Classify demo tab verified in app) · phase **not closed** (see §3 RT-03–RT-07)

**In-app test now:** Export Controls → **Classify** tab → “Run demo classification” (Groq + rules, not trained model).

---

## Phase 4 — Sanctions screening engine

- [x] Canonicaliser — `src/lib/export-controls/sanctions/canonicalise.ts`
- [x] Deterministic scoring + thresholds — `scoring.ts`
- [x] Screen engine + in-memory index — `screen.ts`
- [x] `POST /api/export-controls/screen` — persists to `sanctions_screenings`, checks `isSnapshotFresh`
- [x] In-app test UI — **Sanctions** tab (`export-sanctions-panel.tsx`)
- [x] Test pack (fixture) — `tests/export-controls/sanctions-screen.test.ts`, `fixtures/sanctions-mini.json`
- [x] Daily cron **partial** — hash/stale check only (`convex/actions/sanctions.ts`) — **return-to RT-08**
- [x] `isSnapshotFresh` wired in screen route — **return-to RT-09** for full CLEAR gate
- [ ] Confirm/dismiss screening UI with justification — `reviewSanctionsScreening` exists, no pane yet
- [ ] Full cron auto-ingest to R2 — **deferred to go-live (RT-08)**; manual: `npm run export-controls:ingest-sanctions` + `upload-sanctions`

**Phase 4:** core shipped · phase **not closed** (see §3 RT-08, RT-09, confirm/dismiss UI)

**In-app test now:** Export Controls → **Sanctions** tab → pick demo case → “Run demo screening”.

---

## Phase 5 — Destination + submission routing

All hardcoded TS — this is compliance logic, never AI (`src/lib/export-controls/routing.ts`).

- [ ] SPIRE/OTSI destination table (the 11 verified destinations: Belarus, Burma, Iran, Iraq, Lebanon, Libya, North Korea, Russia, Syria, Venezuela, Zimbabwe) → route `spire` (OTSI-processed)
- [ ] SPIRE-only control entry table (2D352, 3D006, 3E003h, 8A002o4, 9E003a2e, 9E003k, torture-goods annex entries) → route `spire`
- [ ] Transhipment / non-SIEL licence types → route `spire`
- [ ] NI jurisdiction logic: `originJurisdiction === "NI"` → EU Dual-Use Reg 2021/821 framing + flag for review
- [ ] Default eligible case → route `lite`
- [ ] Routing result stored on assessment; unit tests for every branch incl. NI-origin case
- [ ] Routing tables carry a `verifiedAt` date + source URL; stale-check reminder (>90 days) surfaces in admin
- [ ] UI copy exactly: "Open official GOV.UK SIEL service" / "This case must be submitted in SPIRE" / "This case may require OTSI/SPIRE handling (sanctioned destination)"

---

## Phase 6 — Draft pack generator + GOV.UK handoff

- [ ] Draft pack builder: item description, **UK control entry / rating** (never "ECCN"), quantity/value, destination + parties, end-use summary, supporting-doc checklist (EUSU/EUU), reviewer notes
- [ ] Split-pane assessment workspace replacing mock sub-tabs: facts panel (editable extracted fields) · classification pane · sanctions pane · draft pack pane · evidence pane (per-field source page/quote) · action bar
- [ ] Per-field **Copy** buttons with validity warnings (missing mandatory SIEL fields block the copy state, not the view)
- [ ] "Open official GOV.UK service" button (route-aware: LITE start page vs SPIRE) — plain link, **no browser automation**
- [ ] Record-back flow: application reference and later licence number saved to `export_licences`, linked to declaration/shipment
- [ ] Timeline milestones on the assessment: extracted → classified → screened → pack generated → submitted (user-declared) → licence recorded
- [ ] Evidence/audit bundle export (JSON + printable) for customer audit files
- [ ] Timeline copy uses ECJU targets as *aims* with the sensitive-destination caveat

---

## Phase 7 — Expert review workflow

- [ ] "Talk to expert" action on any assessment → creates `expert_requests` row + freezes a case snapshot (versioned)
- [ ] Reviewer queue page: assigned cases, SLA due dates, reason codes (low confidence, sanctions hit, SPIRE exception, NI, novel item)
- [ ] Expert view: extracted facts, candidates, sanctions matches, source evidence, missing-info checklist
- [ ] Expert outcomes: approve entry · override (with justification, logged to `auditLogs`) · request more info · route to SPIRE/OTSI · "external legal opinion required"
- [ ] Consultant RBAC: scoped to assigned cases only (extend existing role handling)
- [ ] Enforcement: FLAGGED and REVIEW_REQUIRED cases cannot produce a final draft pack without an expert/reviewer decision
- [ ] Every override written to an immutable audit trail with old/new values

---

## Phase 8 — Deterministic rules expansion (Path A → Path B)

Exit criteria for the AI-candidate phase: ≥200 reviewed cases, category-level FP/FN baseline, top ambiguous categories identified, sanctions engine stable.

- [ ] Rule compiler: control entries with numeric thresholds → predicate tables `{ parameterKey, operator, thresholdNum, unit, scopeClause, disqualifying }` reviewed by a human before activation
- [ ] Expand coverage in priority order: Cat 3 electronics/microwave → Cat 4 computing (TPP clauses) → Cat 5 telecoms/infosec → highest-volume ML subdomains → long tail
- [ ] Parallel-run mode: rules engine vs AI candidates on the same cases; disagreement dashboard; FP/FN review loop
- [ ] Rules become authoritative per category once calibrated; RAG/LLM demoted to recall aid + explanation layer for that category
- [ ] Regression pack: every activated rule has golden tests (hit, near-miss, exclusion, missing-fact) — updated on any logic change (`.cursorrules` #12)
- [ ] Tamper alarm: rule-table changes logged + alerted

---

## Phase 9 — Integration into the wider app

- [ ] Wire trade-compliance page tabs to real data: Overview KPIs from `export_assessments`, Assessments list from Convex (kill hardcoded `TC-2026-00184`), Audit Log sub-tab from `auditLogs`
- [ ] "Export Controls" step/tab on the declaration detail page (`declarations/[id]/layout.tsx` steps array) — shows linked assessment status, blocks nothing initially
- [ ] Pre-submission nudge: if a declaration's destination/commodity pattern suggests controlled goods and no assessment exists, surface a non-blocking warning in the existing dry-run panel
- [ ] AI assistant context extension: answer "Is this controlled? Why? What's missing?" **from stored deterministic results only** — the assistant explains, it never classifies (`.cursorrules` #3)
- [ ] "Attach to Declaration" and "Import Template" buttons made functional or removed
- [ ] Retention: raw uploads 90 days default, structured facts 12 months, signed expert opinions + audit events 6 years (compliance archive option); deletion honours tombstones

---

## Phase 10 — Go-live gates

Do not open to customers until every box is ticked.

- [ ] Sanctions daily refresh proven for 14 consecutive days (with one simulated failure + alert)
- [ ] Screening blocks CLEAR on stale snapshot (>48h) — tested
- [ ] Classification runs immutable + fully version-pinned — tested
- [ ] Human review enforced on all non-CLEAR terminal states — tested (attempt to bypass fails)
- [ ] SPIRE/OTSI routing branch tests green, routing tables re-verified against GOV.UK within 30 days of launch
- [ ] No user-facing copy implies submission, approval guarantees, or legal advice — copy review done
- [ ] Cross-tenant access tests (assessment, documents, screenings) fail closed
- [ ] Malware scan on uploads before OCR
- [ ] Audit-log immutability test; expert-override trail test
- [ ] Retention + deletion policies active
- [ ] Incident response runbook for: bad sanctions ingest, wrong classification shipped, GOV.UK page/URL changes
- [ ] Consultant workflow live **before** customer self-serve
- [ ] Legal review of disclaimers ("recommendation only, no force in law, exporter remains responsible")

---

## Post-plan revisit — automation & competitive benchmark

**When:** Return here only after **Phases 5–10 are closed** (all return-to rows ticked, go-live gates green). Do not start this thread mid-plan unless product explicitly reprioritises.

**Benchmark:** [AEB Export Controls](https://www.aeb.com/en/export-controls/index.php) — comparison captured in chat 2026-07-04 (AEB = global ERP-integrated transaction screening; FreightCode = UK document-first assessment beside CDS). Re-run comparison before scoping automation work.

**Agreed direction (post-plan):** Shift from **manual assessment-first** toward **more automated screening** — closer to AEB’s “check on create/edit + continuous re-screen” model, but UK-scoped and still human-in-the-loop for non-CLEAR.

**Finish plan first — recommended.** Reasons:

1. **Automation without foundations is risky** — SPIRE/LITE routing (Phase 5), draft pack (Phase 6), expert review (Phase 7), and CLEAR gates (Phase 10) define *what* to automate and *when* to stop the user. Auto-screening before those exist would fire incomplete checks.
2. **Manual flow is still incomplete** — RT-03/04 (documents → classify → review), RT-08/09 (sanctions freshness), assessment shell wiring. Automating a broken manual path duplicates work.
3. **Go-live intent is consultant-first** — BUILD-PLAN Phase 10 requires human review on all non-CLEAR states before customer self-serve. Automation should *assist* reviewers, not replace them at launch.
4. **Natural automation hooks are in Phase 9** — declaration create/edit triggers and pre-submission nudges are already planned there; building them now would pull Phase 9 forward and stall Phases 5–6.

**Do not defer entirely:** Keep **RT-08** (daily UKSL ingest) and **RT-09** (stale snapshot blocks CLEAR) on track for go-live — that is “automated data”, not “automated workflow”, and belongs in Phase 10.

**Likely post-plan automation backlog (draft — decide after benchmark revisit):**

| Item | Notes |
|------|--------|
| Screen on declaration create / edit | Reuse Phase 9 declaration link; optional assessment auto-create |
| Re-screen when destination or consignee changes | Convex mutation hook or scheduled job on open assessments |
| Batch / file check (multi-shipment) | AEB-style; lower priority unless broker customers ask |
| Pre-CDS soft warning vs hard block | Product decision (RT Phase 9 open question); default warn-only |
| Email / in-app alerts on FLAGGED | After audit trail + roles stable |
| Company-specific embargo rules | Large scope; only if UK-only customers need it — not AEB parity |

**Explicit non-goals for automation phase (unless product changes):** SAP/ERP blocks, US EAR, multi-jurisdiction rule engine, in-app licence submission to GOV.UK.

---

## V1 Engineering Spec — deferred backlog (agreed 2026-07-09)

Captured from the *Freightcode Export Controls v1* product spec. **Do not build until Phases 7–9 foundations are closed** unless product explicitly reprioritises. Items marked **aligned** already exist under different names — extend, don’t rewrite.

### Agreed principles (keep forever)

| Principle | Status |
|-----------|--------|
| Compliance module inside Freightcode, not a separate product | **aligned** — Trade Compliance page + assessment sheet |
| Clipboard companion → human pastes into GOV.UK (no auto-submit) | **aligned** — Draft Pack copy fields + Licences record-back |
| AI explains; never invents or finalises control values | **aligned** — `.cursorrules` #2–3, BUILD-PLAN §1 |
| UK **control entry / rating** — never "ECCN" in UK UI | **aligned** — reject v1 mockups that say ECCN |
| Four stoplight statuses on declarations | **partial** — map `draft`→Not Assessed, `clear`→Cleared, `review_required`, `flagged`→Blocked |
| Trade Compliance Engine internal tree (Export · Sanctions · Country · Licence · AI) | **aligned** — implement as libs + Convex, not microservices |

### Declaration & goods integration (Phase 9)

| ID | Item | Notes |
|----|------|--------|
| V1-01 | Declaration expandable **Trade Compliance** section (Customs Representation UX pattern) | `tradeComplianceAssessmentId` + status on declaration; "Open Assessment" deep-links to sheet in declaration context |
| V1-02 | Goods Items badge only: `Not Assessed` / `Cleared` / `Review Required` — no clutter on line editor | Minimal surface; link to assessment |
| V1-03 | **Attach to Declaration** functional | Wire header button; persist link both ways |
| V1-04 | Pre-CDS gate: Not Assessed → allow (warn optional); Cleared → allow; Review Required → warn; Blocked → prevent | Product default: warn-only on Review Required |

### Consultant & audit artefacts (Phase 7–8)

| ID | Item | Notes |
|----|------|--------|
| V1-05 | **Expert review & sign-off** — email on send + magic link, record-back on link page | Phase 7 | **done** for link-first path; invited-user path optional later |
| V1-06 | Consultant sign-off unlocks **Attach to Declaration** on FLAGGED cases | Go-live gate (Phase 10) |
| V1-07 | **NLR (No Licence Required) audit note** PDF when Cleared | Exact params checked + control-list version timestamp — legal shield for consultants |
| V1-08 | Audit Log tab wired to `auditLogs` | Immutable history: assessment, engine version, dataset version, reviewer |

### Draft pack & LITE companion enhancements (Phase 6+)

| ID | Item | Notes |
|----|------|--------|
| V1-09 | Split-pane on **declaration page**: customs entry left, LITE companion right when licence indicated | v1 HTML mockup; extend current Draft Pack tab pattern |
| V1-10 | **EUS / EUSU generator** — pre-filled End-User Statement PDF + "Email to buyer" | AI knows specs + control entry; reduces LITE RFI loops |
| V1-11 | ECJU-style field ordering on printable PDF | Open question — walk live LITE form first |
| V1-12 | **ECJU case-officer persona** for technical summary wording | Reduces RFI risk; LLM prompt version, not compliance logic |

### Contextual & engine depth (Phase 8)

| ID | Item | Notes |
|----|------|--------|
| V1-13 | **Military catch-all / end-use context** — flag defence/nuclear/aerospace buyer even when specs clear | Deterministic party/industry signals + AI explanation; never auto-clear |
| V1-14 | Separate reference tables: military vs dual-use vs country restrictions vs licence types | Today: single consolidated UK list in R2; split when ingest matures |
| V1-15 | HS → control-entry correlation table with confidence | Assist retrieval; human confirms |
| V1-16 | Low / Medium / High risk display | Map from existing `flagged` / `review_required` / `clear` + screening bands |

### Post-go-live / data expansion (not UK v1)

| ID | Item | Notes |
|----|------|--------|
| V1-17 | US EAR, OFAC, BIS, EU dual-use datasets | Data expansion on fixed engine architecture — not architecture rewrite |
| V1-18 | OGEL / OIEL / SITCL licence management | Out of scope v1; SIEL + F680 first |
| V1-19 | Batch multi-shipment screening | AEB-style; broker demand |

### Consultant dispatch (V1-20)

| Step | What |
|------|------|
| Send | **Draft Pack → Send to consultant** — enter email on the form; magic link; packet not attached |
| Review | **`/r/export/{token}`** — draft pack copy fields, GOV.UK link, advisory notes, app/licence refs |
| Complete | Sign off (clear) or Block — updates assessment + `expert_requests` + optional `export_licences` |
| Email | Resend when `RESEND_FROM_EMAIL` + `RESEND_API_KEY` set; otherwise link shown for manual copy |

No Settings roster or consultant multi-pick — enter the email each send. Send again with a different address if needed.

**Optional later:** invite consultant as Freightcode user (portal path) — same assessment sheet, no magic link.

### Consultant loop — scope now vs later

**One app (Freightcode).** Magic links are extra pages inside the same product (`/r/export/...`, `/r/end-user/...`). Not a separate consultant app. Not declaration integration in this slice.

#### Who uses what

| User | What they do | Send to consultant? |
|------|----------------|---------------------|
| **Exporter / broker** | Self-serve: classify → sanctions → draft pack → LITE → record licence | **Optional** — only if they want an external reviewer |
| **Consultancy (logged in)** | Run assessment for a client; classify, draft pack, apply on LITE | **No** — they work in the dashboard; they do not email a link to themselves |
| **Other consultant(s)** | Receive email + link; review, EUS, sign off, record refs | **Yes** — broker *or* consultancy sends **to someone else** |
| **End user (buyer)** | End-user statement on `/r/end-user/{token}` | Sent from Draft Pack **or** consultant review page |

**Rule:** consultant dispatch is **optional**. Never required to use draft pack or record a licence. Go-live gates (later) must allow **self sign-off** when no external consultant is used.

#### Close the loop

| Step | Status |
|------|--------|
| Broker/consultancy runs assessment | Done |
| Send to **other** consultant (email + `/r/export/{token}`) | Done |
| Consultant reviews, GOV.UK, sign off, licence refs | Done |
| **Send to end user** (EUS link `/r/end-user/{token}`) from app + consultant page | Done |
| Broker/consultancy sees Cleared on Overview | Done |

#### Explicitly later (not this slice)

- Declaration **Attach to Declaration** / goods badge (V1-01–03) — broker–declaration link, not consultant loop
- NLR audit note PDF, ECJU AI summary, military catch-all
- Consultant as invited Freightcode user instead of magic link
- Mandatory consultant gate on all Flagged cases

---

## ML / LoRA — when and how (deferred Phase 8+)

**Short answer:** Yes, LoRA *can* be used here — but **not** for binding compliance outcomes. It is a **recall and language assist** layer on top of deterministic rules, human review, and R2 retrieval.

### Hard rules (never LoRA)

Per `.cursorrules` #2–3 and BUILD-PLAN §1 — these stay **hardcoded TypeScript**:

| Concern | Why LoRA is wrong |
|---------|-------------------|
| Final control entry / Cleared vs Blocked | Legal liability; must be rules + human |
| SPIRE/LITE routing, destination tables | Compliance logic |
| Sanctions match thresholds (0.65 / 0.80 bands) | Deterministic scoring |
| Tariff / VAT / CDS validation | Separate domain |

### Where LoRA **can** help (later)

| Use case | Role | Phase |
|----------|------|-------|
| **Control-entry candidate recall** | Rank / suggest entries from product description + specs when lexical retrieval misses | Phase 8 parallel-run vs rules |
| **Cat 3 / Cat 5 electronics** | Fine-tune on labelled cases (RT-06) for microwave, crypto, computing clauses | After ≥200 reviewed overrides |
| **HS → control correlation** | Suggest possible entries from HS + description | Assist only; never auto-approve |
| **ECJU technical summary** | Wording for LITE paste fields (V1-12); ECJU vocabulary | Phase 6+ prompt / optional LoRA |
| **End-use / catch-all context** | Classify buyer business description for defence-adjacent flags (V1-13) | Explanation + flag; human decides |
| **NLR audit note prose** | Template narrative from checked predicates | Generated from deterministic facts; LoRA optional for tone |

### Training data path (required before any control-entry LoRA)

1. **Now:** `reviewClassificationRun` + consultant overrides → **RT-06 labelled corpus**
2. Export format: `{ product, specs, retrievalHits, approvedEntry, rejectedCandidates, controlListVersion }`
3. **Not usable today:** `lora-dataset-worker-json-v2/` and `generate_industrial_dataset.py` — **HS classification awareness only**, not UK control-entry ratings
4. **Infra exists:** `scripts/lora/` (Tinker register/train), `npm run lora:tinker:*` — reuse pipeline with a **new dataset name** when corpus is ready

### Recommended sequence

```
Phase 3–7 (now)     Groq + R2 retrieval + predicates + human review
        ↓
Phase 8             Rule compiler + parallel-run disagreement dashboard
        ↓
RT-06 corpus        ≥200 reviewed cases exported
        ↓
Phase 8b (optional) LoRA fine-tune for recall on top categories (3, 4, 5)
        ↓
Production          LoRA proposes candidates; rules + human still authoritative
```

### Decision gate for starting LoRA work

- [ ] RT-06 export path live
- [ ] ≥200 human-reviewed cases with `finalControlEntry` set
- [ ] Category-level FP/FN baseline from Phase 8 parallel-run
- [ ] Legal/product sign-off that LoRA output is labelled "candidate" in UI
- [ ] New dataset JSONL (control-entry labels), not HS worker-json

Until then: **Groq + R2 + predicates** remains the path (open question Phase 3 — keep checked as deferred).

---

## Out of scope (explicit)

- Direct submission to LITE/SPIRE (no public API; browser automation is banned)
- US ECCN classification (UK control entries only, this phase)
- OGEL/OIEL licence management (SIEL + F680 draft packs first)
- Non-UK sanctions regimes (OFAC etc.)

## Open questions (decide before the relevant phase)

- [x] Phase 1a: PDF parsing quality — **480 entries parsed; golden tests pass.** Sub-clause refs like `8A002o4` live inside parent entry text (not separate top-level rows). Monitor on next list update.
- [x] Phase 3: **Groq + R2 retrieval** for classification pass (current path). LoRA deferred — see §ML/LoRA; existing `lora-dataset/` is HS-side only
- [ ] Phase 6: does the draft pack PDF need ECJU-style field ordering to mirror the LITE form? Needs a walkthrough of the live LITE form fields
- [ ] Phase 9: should a FLAGGED export assessment ever block CDS submission, or warn only? (Product decision — default: warn only)
