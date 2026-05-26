> **ARCHIVED** — This execution plan is for the TDR (v1.0) phase which is not the current active environment.
> The system currently runs on **Trade Test v2.0** (sandbox) and **v2.0** (production).
> This file is preserved for reference only. Do not use for configuration or operational decisions.

# Freightcode — TDR Execution Plan & Quality-Gated Checklist
**Version:** 1.0  
**Date:** 2026-04-11  
**Status:** ACTIVE — Governing document for all TDR submissions  
**Owner:** TDR Run Manager (Jason Dean)  
**Reviewer:** TDR Run Manager + Compliance Lead (co-sign required before each gate)

---

## Document Purpose

This plan governs every action taken from current state (CDS12050 rejection, evidence governance breach) to a complete, auditable TDR pass-evidence chain acceptable to HMRC's Software Developer Support Team (SDST). No submission to TDR may occur without passing the gate defined for that phase. No feature development, UI changes, or refactoring may be merged during active TDR phases (P0–P4).

---

## TDR Readiness Baseline (as of 2026-04-09)

| Domain | Score | Detail |
|--------|-------|--------|
| Infrastructure / Transport | 75% | OAuth, webhooks, schema stable. 27/27 readiness tests pass |
| Data / Business-Rule | 35% | CDS12050 active on HS 0207129000 / CPC 4000 000 / BR lane |
| Evidence Governance | 50% | Breach resolved; controls not yet hardened |
| Overall Weighted | **~48% — NOT PASS-READY** | |

---

## RACI Matrix

| Role | Name | Responsibility |
|------|------|---------------|
| TDR Run Manager | Jason Dean | Owns each submission decision; sole authority to approve TDR gate passage |
| Compliance Lead | Jason Dean | Signs off tariff-document decision matrix before any payload change |
| Backend Engineer | Jason Dean | Implements payload corrections; produces dry-run evidence |
| Platform Owner | Jason Dean | Confirms Convex account stability; no platform changes during run window |
| Evidence Custodian | Jason Dean | Maintains immutable evidence bundle; controls `test-evidence/` folder |

> **Note:** Single-person team. All roles held by Jason Dean. Explicit self-review steps are mandatory — each gate requires a signed checklist item, not an assumption.

---

## Phase Summary & Timeline

| Phase | Name | Status | Gate |
|-------|------|--------|------|
| **P0** | Governance & Environment Reset | ⬜ Not started | P0-EXIT |
| **P1** | Tariff-Document Decision Matrix | ⬜ Not started | P1-EXIT |
| **P2** | Data Correction & Payload Rebuild | ⬜ Not started | P2-EXIT |
| **P3** | Local Dry-Run Certification | ⬜ Not started | P3-EXIT |
| **P4** | Single Controlled TDR Submission | ⬜ Not started | P4-EXIT |
| **P5** | Notification Evidence Chain | ⬜ Not started | P5-EXIT |
| **P6** | Amendment Evidence (if required) | ⬜ Not started | P6-EXIT |
| **P7** | Final Evidence Bundle & HMRC Sign-Off | ⬜ Not started | P7-EXIT |

---

---

# PHASE 0 — Governance & Environment Reset

**Purpose:** Stop all non-TDR work; restore evidence integrity; confirm platform stability.  
**Owner:** TDR Run Manager  
**Target duration:** 0–2 hours

## P0 Entry Criteria
- [ ] This document has been read and acknowledged by TDR Run Manager
- [ ] No active deployment in progress

## P0 Checklist

### P0.1 — Scope Freeze
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P0.1.1 | No non-TDR code changes are in progress on `main` | `git status` — must show clean or only TDR-related files | TDR Run Manager | ⬜ |
| P0.1.2 | No new features, UI changes, or refactors merged during Phases P0–P5 | Decision log entry | TDR Run Manager | ⬜ |
| P0.1.3 | All outstanding uncommitted changes reviewed and categorised as TDR-critical or deferred | `git diff --stat HEAD` reviewed line-by-line | TDR Run Manager | ⬜ |

### P0.2 — Evidence Integrity Restore
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P0.2.1 | `notifications` table in Convex contains ZERO synthetic/test entries created outside of HMRC | Query Convex dashboard; inspect `notificationType` and `rawPayload` | Compliance Lead | ⬜ |
| P0.2.2 | All notification entries have `rawPayload` containing actual HMRC XML (not placeholder/empty strings) | Spot-check 5 most recent rows | Compliance Lead | ⬜ |
| P0.2.3 | Declaration status fields reflect HMRC-derived events only, not manually set UI overrides | Cross-reference declaration `status` against `notifications` table for all non-Draft records | Compliance Lead | ⬜ |
| P0.2.4 | `test-evidence/` folder archived — move current contents to `test-evidence/archive-pre-p0/` before new run | `mkdir test-evidence/archive-pre-p0 && mv test-evidence/*.xml test-evidence/*.json test-evidence/archive-pre-p0/` | Evidence Custodian | ⬜ |

### P0.3 — Platform & Service Stability
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P0.3.1 | Convex account is active and all queries/mutations responding | `curl /api/health` — verify `"convex":true` | Platform Owner | ⬜ |
| P0.3.2 | HMRC OAuth token is valid and not expiring within 24 hours | Check Convex `hmrc_tokens` table: `expiresAt > Date.now() + 86400000` | Backend Engineer | ⬜ |
| P0.3.3 | HMRC_ENVIRONMENT is `sandbox` | `printenv HMRC_ENVIRONMENT` — must return `sandbox` | Backend Engineer | ⬜ |
| P0.3.4 | `HMRC_WEBHOOK_AUTH_TOKEN` env var is set and matches deployed endpoint config | Check `.env.local` against Vercel env | Platform Owner | ⬜ |
| P0.3.5 | Webhook endpoint is publicly accessible from internet | `curl -X POST https://{deployed-url}/api/hmrc/webhooks/notify` — expect 401 (not 404/502) | Platform Owner | ⬜ |
| P0.3.6 | `next build` passes with zero errors | `npm run build` — exit code 0 | Backend Engineer | ⬜ |

### P0.4 — Documentation
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P0.4.1 | CLAUDE.md is committed and up to date | `git log --oneline CLAUDE.md` shows recent commit | TDR Run Manager | ⬜ |
| P0.4.2 | This TDR_EXECUTION_PLAN.md is committed | `git log --oneline documentation/TDR_EXECUTION_PLAN.md` | TDR Run Manager | ⬜ |
| P0.4.3 | Runbook at `documentation/runbook.md` is accessible and not stale | Manual review — confirm deployed URL and webhook URL are current | Compliance Lead | ⬜ |

## P0 Exit Criteria (Gate P0-EXIT)
- [ ] All P0 checklist items marked ✅
- [ ] `test-evidence/archive-pre-p0/` created with prior evidence preserved
- [ ] TDR Run Manager signature: _________________ Date: _____________

**If any P0 item fails → STOP. Resolve before proceeding.**

---

# PHASE 1 — Tariff-Document Decision Matrix

**Purpose:** Establish the authoritative, signed document requirements for the specific TDR lane before touching any code. Resolve CDS12050 root cause at the source.  
**Owner:** Compliance Lead + Backend Engineer  
**Target duration:** 2–6 hours

## P1 Entry Criteria
- [ ] P0-EXIT gate passed and signed

## Current Blocker Context

**Error:** CDS12050 — HMRC Rules Engine rejected declaration at item-document validation level  
**Lane under test:**
- Commodity: `0207129000` (frozen whole poultry, gallus domesticus, not cut)
- CPC (DE 1/10): `40` / PreviousCode `00` → free circulation import
- Additional CPC (DE 1/11): `000`
- Origin: `BR` (Brazil)
- Declaration type: `IMA` (H1 dataset)
- Current additional document in payload: `CategoryCode: Y, TypeCode: 922, ID: 922`

**Hypothesis:** `Y922` ("document not required" declaration) is not a valid override for HS 0207129000 from Brazil. This commodity requires specific controlled-goods documentation under UK import controls for animal products from third countries.

## P1 Checklist

### P1.1 — Commodity Classification Verification
| ID | Item | Source | Reviewer | Status |
|----|------|--------|----------|--------|
| P1.1.1 | Confirm HS 0207129000 is correct 10-digit code for "frozen whole poultry of the species Gallus domesticus, plucked and drawn, not cut in pieces" | UK Trade Tariff: trade-tariff.service.gov.uk/commodities/0207129000 | Compliance Lead | ⬜ |
| P1.1.2 | Confirm commodity is classified as Schedule 3 controlled goods (animal product from third country) | UK Trade Tariff commodity page → "Import controls" section | Compliance Lead | ⬜ |
| P1.1.3 | Record all active import measures for BR origin: duties, quotas, licences, prohibitions | UK Trade Tariff → "Import measures" tab for 0207129000 | Compliance Lead | ⬜ |
| P1.1.4 | Record whether TRQ (Tariff Rate Quota) applies to BR poultry and if quota licence document is required | UK Trade Tariff → "Quotas" tab; check order numbers | Compliance Lead | ⬜ |

### P1.2 — Mandatory Document Codes (DE 2/3)
| ID | Item | Expected Finding | Source | Reviewer | Status |
|----|------|----------------|--------|----------|--------|
| P1.2.1 | Identify all mandatory additional documents for 0207129000 / BR / CPC 4000 | At minimum: CHED-A health certificate (N002 or C400 family) | UK Trade Tariff + IPAFFS guidance | Compliance Lead | ⬜ |
| P1.2.2 | Confirm whether `C400` (Veterinary health certificate) is required for BR poultry | C400 = Animal Health Certificate from exporting country; mandatory for animal products | HMRC CDS DE 2/3 Appendix 5 (Union codes) | Compliance Lead | ⬜ |
| P1.2.3 | Confirm whether `N002` (CHED-A: Common Health Entry Document – Animals) is required | N002 = mandatory for controlled animal products from third countries under IPAFFS | HMRC CDS DE 2/3 Appendix 5 (Union codes) | Compliance Lead | ⬜ |
| P1.2.4 | Confirm whether `9120` (IPAFFS pre-notification reference) is required | 9120 = IPAFFS notification number; required if CHED-A required | HMRC CDS DE 2/3 Appendix 1 (National codes) | Compliance Lead | ⬜ |
| P1.2.5 | Confirm whether `Y922` is a permitted override for this commodity+origin | Y922 should NOT be used for Schedule 3 controlled goods — verify explicitly | HMRC CDS Vol 3 Appendix 5 — Y-code notes | Compliance Lead | ⬜ |
| P1.2.6 | For TDR sandbox: identify which document codes HMRC accepts as test placeholders | HMRC sandbox accepts specific test document IDs; check HMRC TDR guidance for allowed test values | TDRcommunications@hmrc.gov.uk or SDST guidance | Compliance Lead | ⬜ |

### P1.3 — CDS12050 Error Code Root Cause
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P1.3.1 | Retrieve full DMSREJ notification payload from Convex `notifications` table for the last rejected submission | Query: `notifications` table by `notificationType = "DMSREJ"`, inspect `rawPayload`, extract all `<ErrorPointer>` and `<NameCode>` elements | Backend Engineer | ⬜ |
| P1.3.2 | Map each sub-error code (42A, 67A, 68A, 70A) to the specific DE field they reference | Cross-reference against HMRC CDS Technical Completion Matrix (TCM) v3.92 in `documentation/hmrc_tdr_audit/` | Backend Engineer | ⬜ |
| P1.3.3 | Confirm whether CDS12050 is a tariff document error or a data element format error | CDS12050 definition: check HMRC known error workarounds (gov.uk publication) | Compliance Lead | ⬜ |
| P1.3.4 | Document the exact XML path(s) HMRC flagged in the rejection | Extract from `<ErrorPointer>` in DMSREJ raw payload | Backend Engineer | ⬜ |

### P1.4 — Decision Matrix (Sign-Off Document)

**SIGNED — 2026-04-11 by TDR Run Manager (Jason Dean)**  
**Source:** UK Trade Tariff commodity 0207129000 + country BR, Veterinary Control Measure 20234422 (S.I. 2019/782), Organic Control measure.

```
LANE DOCUMENT DECISION MATRIX — SIGNED
=======================================
Lane: HS 0207129000 / CPC 4000 000 / Origin BR / Type IMA
Source: trade-tariff.service.gov.uk/commodities/0207129000?country=BR (fetched 2026-04-11)

Document                                | Cat | Type | StatusCode | ID (TDR test value)        | Obligation | Trigger measure
----------------------------------------|-----|------|------------|----------------------------|------------|----------------
CHED-P (Common Health Entry Doc)        |  N  | 853  |   AE       | GBCHD2024.1234567          |  MANDATORY | Veterinary ctrl 20234422 — all 3rd countries
Commission Decision 2007/275 exclusion  |  Y  | 930  |   XB       | Excluded                   |  MANDATORY | Required alongside N853 for non-research goods
Non-organic goods declaration           |  Y  | 929  |   XB       | Excluded                   |  MANDATORY | Organic ctrl measure — non-organic commercial goods

REMOVED: Y922 | Y | 922 | 922 — REASON: "document not required" override invalid for
             Schedule 3 veterinary controlled goods. Using Y922 without N853 leaves
             the mandatory CHED-P pathway unfulfilled, triggering CDS12050.
```

**Root cause of CDS12050 confirmed:** Veterinary Control Measure 20234422 requires N853
(CHED-P pre-notification reference, format `GBCHDyyyy.xxxxxxx`) as the only commercial
import pathway. Y922 does not satisfy this measure. Sub-error codes 42A/67A/68A/70A map to
the DE 2/3 document element fields (CategoryCode/TypeCode/ID/StatusCode) that are either
missing or using a non-permitted code for this commodity.

| ID | Item | Status |
|----|------|--------|
| P1.4.1 | Decision matrix table above is fully populated | ✅ |
| P1.4.2 | All mandatory (M) documents have a valid test-mode ID confirmed by HMRC documentation | ✅ |
| P1.4.3 | All optional (O) documents have a documented justification for inclusion or exclusion | ✅ |
| P1.4.4 | Y922 removal is explicitly documented with the reason | ✅ |
| P1.4.5 | Matrix has been reviewed against at least one external HMRC reference (not derived from inference alone) | ⬜ |
| P1.4.6 | Matrix signed off: TDR Run Manager _________________ Date: _____________ | ⬜ |

### P1.5 — Alternative Lane Assessment (Risk Mitigation)
| ID | Item | Reviewer | Status |
|----|------|----------|--------|
| P1.5.1 | If correct document codes for 0207129000/BR cannot be confirmed within 6 hours, assess switching to a lower-risk commodity for TDR (e.g. HS 6110201000, which has been previously accepted) | TDR Run Manager | ⬜ |
| P1.5.2 | If lane is switched: repeat full P1 checklist for the new commodity | Compliance Lead | ⬜ |
| P1.5.3 | Decision to switch lane (or not) is logged with justification | TDR Run Manager | ⬜ |

## P1 Exit Criteria (Gate P1-EXIT)
- [ ] All P1 checklist items marked ✅
- [ ] Decision matrix table is complete with real document codes (not placeholders)
- [ ] Matrix signed by TDR Run Manager
- [ ] CDS12050 root cause documented and confirmed
- [ ] Compliance Lead signature: _________________ Date: _____________

**If CDS12050 root cause cannot be confirmed → contact HMRC SDST before proceeding.**

---

# PHASE 2 — Data Correction & Payload Rebuild

**Purpose:** Apply the signed decision matrix to the codebase and test data. Produce a corrected XML payload ready for dry-run.  
**Owner:** Backend Engineer  
**Target duration:** 2–4 hours

## P2 Entry Criteria
- [ ] P1-EXIT gate passed and signed
- [ ] Signed decision matrix is committed to `documentation/`

## P2 Checklist

### P2.1 — Test Declaration Data Setup
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P2.1.1 | Create (or verify) a single test declaration in Convex with correct EORI `GB553202734852` | Check Convex declarations table or create via UI | Backend Engineer | ⬜ |
| P2.1.2 | Declaration has exactly ONE goods item | Convex goods_items table check | Backend Engineer | ⬜ |
| P2.1.3 | Goods item has: `commodityCode = "0207129000"`, `originCountry = "BR"`, `procedureCode = "4000"` | Convex goods_items row inspection | Backend Engineer | ⬜ |
| P2.1.4 | Goods item `description` is realistic: "Frozen whole chicken, not cut in pieces, Gallus domesticus" | Convex goods_items row inspection | Backend Engineer | ⬜ |
| P2.1.5 | Goods item `valueAmount` is realistic (e.g. 4200), `valueCurrency = "GBP"` | Convex goods_items row inspection | Backend Engineer | ⬜ |
| P2.1.6 | Goods item `grossWeightKg` is realistic (e.g. 120), `netWeightKg` set (e.g. 118) | Convex goods_items row inspection | Backend Engineer | ⬜ |
| P2.1.7 | Goods item `additionalDocuments` array is populated with ONLY documents from the signed decision matrix — Y922 is absent | Convex goods_items row inspection | Compliance Lead | ⬜ |
| P2.1.8 | Declaration `dispatchCountry` is set to `BR` (NOT `GB`) | Convex declarations row inspection | Backend Engineer | ⬜ |
| P2.1.9 | Declaration `destinationCountry` is set to `GB` | Convex declarations row inspection | Backend Engineer | ⬜ |
| P2.1.10 | DUCR format is `9GB{EORI}-{unique-ref}` with no spaces, max 35 chars | Manual check of generated DUCR value | Backend Engineer | ⬜ |

### P2.2 — WCO Mapper Verification (src/lib/wco-mapper.ts)
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P2.2.1 | `GovernmentProcedure` DE 1/10: first element has `CurrentCode = "40"` (2 chars), `PreviousCode = "00"` (2 chars) | Code review + console.log payload check | Backend Engineer | ⬜ |
| P2.2.2 | `GovernmentProcedure` DE 1/11: second element has `CurrentCode = "000"` (3 chars), no `PreviousCode` | Code review + console.log payload check | Backend Engineer | ⬜ |
| P2.2.3 | `mapToCDS_H1` passes through `additionalDocuments` from goods item — not hardcoded Y922 | Code review of wco-mapper.ts L154-L176 | Backend Engineer | ⬜ |
| P2.2.4 | `ExportCountry.ID` maps from `declaration.dispatchCountry` — not hardcoded to `"GB"` or `"US"` | Code review of wco-mapper.ts L143 | Backend Engineer | ⬜ |
| P2.2.5 | `Exporter.ID` is set to a valid EORI — not defaulting to placeholder `"GB123456789000"` | Code review of wco-mapper.ts L121 | Backend Engineer | ⬜ |

### P2.3 — Scenario Runner Verification (test-evidence/run-hmrc-scenarios.js)
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P2.3.1 | Script's local `mapToCDS_H1` function: `GovernmentProcedure` produces 2 separate elements (40/00 + 000) — not single 4-digit+3-digit element | Code review run-hmrc-scenarios.js L75-L81 — fix if still wrong | Backend Engineer | ⬜ |
| P2.3.2 | Script's `acceptHeader` default is `application/vnd.hmrc.1.0+xml` — not `vnd.hmrc.2.0+xml` | Code review run-hmrc-scenarios.js L247 | Backend Engineer | ⬜ |
| P2.3.3 | Script's `itemSeed.additionalDocuments` array uses ONLY documents from signed decision matrix | Code review / update run-hmrc-scenarios.js | Backend Engineer | ⬜ |
| P2.3.4 | Script's `baseDecl.dispatchCountry` is set to `"BR"` — not `"GB"` | Code review run-hmrc-scenarios.js L358 | Backend Engineer | ⬜ |

### P2.4 — XML Payload Manual Review
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P2.4.1 | Run dry-run locally (`DRY_RUN_ONLY=true node test-evidence/run-hmrc-scenarios.js`) and inspect generated XML in `test-evidence/tdr-cds-v1-request.xml` | File inspection | Backend Engineer | ⬜ |
| P2.4.2 | XML contains ZERO instances of `Y922` or `922` as a document code | `grep -i "922" test-evidence/tdr-cds-v1-request.xml` — must return nothing | Compliance Lead | ⬜ |
| P2.4.3 | XML `<AdditionalDocument>` block contains exactly the codes from the signed decision matrix | Manual comparison of XML against decision matrix table | Compliance Lead | ⬜ |
| P2.4.4 | XML `<ExportCountry><ID>` = `BR` | Grep check | Backend Engineer | ⬜ |
| P2.4.5 | XML `<GovernmentProcedure>` has exactly 2 elements: first with 2-digit codes, second with 3-digit CurrentCode only | Manual XML review | Backend Engineer | ⬜ |
| P2.4.6 | XML `<FunctionCode>9</FunctionCode>` (new declaration, not amendment) | Manual XML review | Backend Engineer | ⬜ |
| P2.4.7 | XML `<TypeCode>IMA</TypeCode>` | Manual XML review | Backend Engineer | ⬜ |
| P2.4.8 | All EORI references in XML (`Declarant.ID`, `Importer.ID`, `Exporter.ID`) are valid `GB{12digits}` format | Manual XML review + regex check | Backend Engineer | ⬜ |
| P2.4.9 | XML passes internal `validateXmlPreflight()` function checks | Log output from dry-run | Backend Engineer | ⬜ |
| P2.4.10 | Payload diff from previous (failed) submission is documented — list every changed element | `diff` against archived pre-P0 request XML | Compliance Lead | ⬜ |

### P2.5 — Change Control
| ID | Item | Method | Reviewer | Status |
|----|------|--------|----------|--------|
| P2.5.1 | All payload changes are committed with a message referencing CDS12050 and the signed matrix | `git log` | TDR Run Manager | ⬜ |
| P2.5.2 | No other unrelated changes are committed in the same commit | `git diff HEAD~1` reviewed | TDR Run Manager | ⬜ |

## P2 Exit Criteria (Gate P2-EXIT)
- [ ] All P2 checklist items marked ✅
- [ ] Corrected XML payload saved to `test-evidence/tdr-cds-v1-request.xml` (dry-run output)
- [ ] Payload diff document saved to `test-evidence/p2-payload-diff.md`
- [ ] No Y922 in payload
- [ ] Backend Engineer signature: _________________ Date: _____________

---

# PHASE 3 — Local Dry-Run Certification

**Purpose:** Run all automated preflight checks against the corrected payload and confirm 100% pass before touching TDR.  
**Owner:** Backend Engineer  
**Target duration:** 1–2 hours

## P3 Entry Criteria
- [ ] P2-EXIT gate passed and signed

## P3 Checklist

### P3.1 — Infrastructure Readiness
| ID | Item | Command | Expected Result | Status |
|----|------|---------|----------------|--------|
| P3.1.1 | Build passes | `npm run build` | Exit code 0, no errors | ⬜ |
| P3.1.2 | Health endpoint responds | `curl http://localhost:3000/api/health` | `{"status":"ok","environment":"sandbox"}` | ⬜ |
| P3.1.3 | HMRC token valid | Check Convex hmrc_tokens, `expiresAt > now + 1h` | Token present and not expiring | ⬜ |

### P3.2 — Dry-Run Gate (14-Point Preflight)
| ID | Check | Expected | Status |
|----|-------|----------|--------|
| P3.2.1 | `token_present` | ✅ | ⬜ |
| P3.2.2 | `client_id_present` | ✅ | ⬜ |
| P3.2.3 | `environment_is_sandbox` | ✅ | ⬜ |
| P3.2.4 | `endpoint_is_test_api` | ✅ | ⬜ |
| P3.2.5 | `accept_is_v1` | ✅ application/vnd.hmrc.1.0+xml | ⬜ |
| P3.2.6 | `content_type_is_xml` | ✅ | ⬜ |
| P3.2.7 | `xml_has_metadata_root` | ✅ | ⬜ |
| P3.2.8 | `xml_has_declaration` | ✅ | ⬜ |
| P3.2.9 | `xml_has_function_code` | ✅ FunctionCode 9 | ⬜ |
| P3.2.10 | `xml_has_type_code` | ✅ TypeCode IMA | ⬜ |
| P3.2.11 | `xml_has_declarant_id` | ✅ EORI present | ⬜ |
| P3.2.12 | `xml_has_importer_id` | ✅ EORI present | ⬜ |
| P3.2.13 | `xml_has_hs_code` | ✅ 0207129000 | ⬜ |
| P3.2.14 | `eori_format_valid` | ✅ GB + 12 digits | ⬜ |

**Run command:**
```bash
node test-evidence/run-hmrc-scenarios.js
# Check: test-evidence/tdr-cds-v1-dry-run.json — readyToSubmit must be true, failed array must be empty
```

### P3.3 — Fraud Prevention Header Verification
| ID | Header | Required | Status |
|----|--------|----------|--------|
| P3.3.1 | `Gov-Client-Connection-Method` | WEB_APP_VIA_SERVER | ⬜ |
| P3.3.2 | `Gov-Vendor-Version` | Freightcode=1.0.0 | ⬜ |
| P3.3.3 | `Gov-Vendor-Product-Name` | Freightcode (URL-encoded) | ⬜ |
| P3.3.4 | `Gov-Client-Public-IP` | Non-empty, non-localhost | ⬜ |
| P3.3.5 | `Gov-Client-Timezone` | UTC±HH:MM format | ⬜ |
| P3.3.6 | `Gov-Client-Window-Size` | width=N&height=N | ⬜ |
| P3.3.7 | `Gov-Client-Screens` | width, height, scaling-factor, colour-depth | ⬜ |
| P3.3.8 | `Gov-Client-Browser-JS-User-Agent` | Non-empty | ⬜ |
| P3.3.9 | `Gov-Client-Browser-Do-Not-Track` | true/false | ⬜ |
| P3.3.10 | `Gov-Client-Device-ID` | UUID format, persistent across sessions | ⬜ |
| P3.3.11 | `Gov-Client-User-IDs` | appUser=... | ⬜ |
| P3.3.12 | `Gov-Client-Local-IPs` | Non-empty | ⬜ |

### P3.4 — CDS Field Validation (`validateCdsFields`)
| ID | Field | Rule | Status |
|----|-------|------|--------|
| P3.4.1 | `eori` | `^GB\d{12}$` | ⬜ |
| P3.4.2 | `invoiceCurrency` | Valid ISO 4217 | ⬜ |
| P3.4.3 | `destinationCountry` | Valid ISO 3166-1 alpha-2 | ⬜ |
| P3.4.4 | `dispatchCountry` | Valid ISO 3166-1 alpha-2, not GB | ⬜ |
| P3.4.5 | `items[0].commodityCode` | Exactly 10 digits | ⬜ |
| P3.4.6 | `items[0].procedureCode` | 4-digit CPC | ⬜ |
| P3.4.7 | `items[0].originCountry` | Valid ISO 3166-1 alpha-2 | ⬜ |

### P3.5 — Document Evidence Capture
| ID | Item | Method | Status |
|----|------|--------|--------|
| P3.5.1 | `tdr-cds-v1-dry-run.json` saved with `readyToSubmit: true` | File check | ⬜ |
| P3.5.2 | `tdr-cds-v1-request.xml` saved and reviewed — no Y922, correct GovernmentProcedure, correct ExportCountry | File review | ⬜ |
| P3.5.3 | SHA-256 hash of request XML recorded for traceability | `sha256sum test-evidence/tdr-cds-v1-request.xml` | ⬜ |

## P3 Exit Criteria (Gate P3-EXIT)
- [ ] All 14 preflight checks pass (`readyToSubmit: true`, `failed: []`)
- [ ] All P3 checklist items marked ✅
- [ ] Request XML hash recorded
- [ ] `tdr-cds-v1-dry-run.json` committed to `test-evidence/`
- [ ] Backend Engineer signature: _________________ Date: _____________

**If any preflight check fails → return to P2. Do NOT submit to TDR.**

---

# PHASE 4 — Single Controlled TDR Submission

**Purpose:** One submission to TDR with full evidence capture. No retries unless a new gate is passed.  
**Owner:** TDR Run Manager  
**Target duration:** 30 minutes (submit) + up to 4 hours (await notifications)

## P4 Entry Criteria
- [ ] P3-EXIT gate passed and signed
- [ ] Current time is within business hours (avoid late Friday, public holidays)
- [ ] No Convex or Vercel maintenance window active
- [ ] HMRC API status page confirms no incidents: https://api-platform-status.production.tax.service.gov.uk/

## P4 Pre-Submission Checklist (run immediately before submitting)

| ID | Item | Check | Status |
|----|------|-------|--------|
| P4.1 | HMRC token not expired | `expiresAt > now + 3600000` (1 hour buffer) | ⬜ |
| P4.2 | `HMRC_ENVIRONMENT=sandbox` | `printenv HMRC_ENVIRONMENT` | ⬜ |
| P4.3 | `Gov-Test-Scenario` set correctly | Check `.env.local` — `HMRC_TEST_SCENARIO=HAPPY_PATH` | ⬜ |
| P4.4 | Webhook endpoint is live and responding 401 | `curl -X POST https://{deployed-url}/api/hmrc/webhooks/notify` | ⬜ |
| P4.5 | Dry-run passes one final time | Re-run `node test-evidence/run-hmrc-scenarios.js` — confirm `readyToSubmit: true` | ⬜ |
| P4.6 | No other submissions will occur during this window | Decision log confirmed | ⬜ |
| P4.7 | `test-evidence/tdr-cds-v1-request.xml` hash matches hash recorded in P3.5.3 | `sha256sum test-evidence/tdr-cds-v1-request.xml` | ⬜ |
| P4.8 | TDR Run Manager is available to monitor for at least 4 hours after submission | Availability confirmed | ⬜ |

## P4 Submission Execution

**Command:**
```bash
DRY_RUN_ONLY=false HMRC_SUBMIT_ONCE=true node test-evidence/run-hmrc-scenarios.js
```

**Immediately capture:**
| ID | Item | Where to Find | Record Here |
|----|------|--------------|-------------|
| P4.S.1 | HTTP response status code | `test-evidence/scenario-summary.json` → `status` | |
| P4.S.2 | X-Conversation-ID | `test-evidence/scenario-summary.json` → `conversationId` | |
| P4.S.3 | Submission timestamp | `test-evidence/scenario-summary.json` → `timestamp` | |
| P4.S.4 | `tdr-cds-v1-response.xml` saved | File check | |
| P4.S.5 | Exact HTTP response body recorded | `test-evidence/tdr-cds-v1-response.xml` content | |

## P4 Response Assessment

| Response | Action | Proceed? |
|----------|--------|----------|
| **202 Accepted** | Record Conversation-ID in declaration; wait for DMS notification | YES → P5 |
| **400 Bad Request** | Parse XML error response; identify field; return to P2 | NO → P2 |
| **401 Unauthorized** | Token expired or invalid; refresh token; re-run P3; re-gate P4 | NO → fix token |
| **403 PAYLOAD_FORBIDDEN** | WAF block; do NOT retry; contact SDST with Conversation-ID | NO → contact HMRC |
| **403 (other)** | Auth/subscription issue; contact SDST | NO → contact HMRC |
| **422 Unprocessable** | Business-rule error; parse `<ErrorPointer>` elements; return to P1 | NO → P1 |
| **429 Too Many Requests** | Rate limit hit; wait 60 seconds; retry ONCE only | ONE retry |
| **5xx** | Server error; wait 5 minutes; retry ONCE only | ONE retry |

### P4 Post-Submission Checks
| ID | Item | Method | Status |
|----|------|--------|--------|
| P4.9 | HTTP 202 received | Check `scenario-summary.json` → `status = 202` | ⬜ |
| P4.10 | Conversation-ID is non-empty UUID | Check `scenario-summary.json` → `conversationId` | ⬜ |
| P4.11 | Conversation-ID stored against declaration in Convex | Check Convex declarations table | ⬜ |
| P4.12 | Declaration status updated to "Processing" in Convex | Check Convex declarations table | ⬜ |
| P4.13 | Audit log entry created in Convex `auditLogs` table | Query by action=declaration_submitted | ⬜ |
| P4.14 | `test-evidence/tdr-cds-v1-response.xml` and `scenario-summary.json` committed immediately | `git add test-evidence/ && git commit` | ⬜ |

## P4 Exit Criteria (Gate P4-EXIT)
- [ ] HTTP 202 received
- [ ] Valid non-empty Conversation-ID captured and stored
- [ ] Evidence files committed
- [ ] TDR Run Manager signature: _________________ Date: _____________

**If HTTP status is not 202 → document in incident log; return to appropriate phase; do NOT proceed to P5.**

---

# PHASE 5 — Notification Evidence Chain

**Purpose:** Capture the complete HMRC notification lifecycle from submission to clearance. This is the primary evidence HMRC evaluates for software recognition.  
**Owner:** Backend Engineer + TDR Run Manager  
**Target duration:** 30 minutes to 48 hours (depends on HMRC processing time)

## P5 Entry Criteria
- [ ] P4-EXIT gate passed and signed
- [ ] Conversation-ID is confirmed and stored

## P5 Checklist

### P5.1 — Push Notification Receipt (webhook)
| ID | Item | Method | Required Within | Status |
|----|------|--------|----------------|--------|
| P5.1.1 | DMSACC (Declaration Accepted) notification received at `/api/hmrc/webhooks/notify` | Check Convex notifications table: `notificationType = "DMSACC"` for this conversationId | 1–30 minutes | ⬜ |
| P5.1.2 | MRN extracted correctly from DMSACC payload | Check `mrn` field in Convex notification row — format: `\d{2}[A-Z]{2}[A-Z0-9]{14}` | Same as above | ⬜ |
| P5.1.3 | MRN stored against declaration in Convex | Check `declarations.mrn` field | Same | ⬜ |
| P5.1.4 | Declaration status updated to "Accepted" | Check Convex declarations table | Same | ⬜ |
| P5.1.5 | `rawPayload` stored verbatim in notifications row | Inspect Convex row | Same | ⬜ |

### P5.2 — Pull Notification Reconciliation
| ID | Item | Method | Status |
|----|------|--------|--------|
| P5.2.1 | Pull notification API called for the Conversation-ID | `GET /api/hmrc/notifications/pull?conversationId={id}` | ⬜ |
| P5.2.2 | Pull API returns same notification(s) as push webhook | Compare `notificationType` and `mrn` between push and pull results | ⬜ |
| P5.2.3 | No `UNKNOWN` notification types in either push or pull results | Check all `notificationType` fields | ⬜ |
| P5.2.4 | No duplicate notifications created in Convex from pull when push already received | Count notifications with matching conversationId | ⬜ |

### P5.3 — Clearance Evidence (DMSCLE)
| ID | Item | Method | Required | Status |
|----|------|--------|----------|--------|
| P5.3.1 | DMSCLE (Declaration Cleared / Goods Released) notification received | Check Convex notifications table: `notificationType = "DMSCLE"` for this MRN | 1–48 hours | ⬜ |
| P5.3.2 | Declaration status updated to "Cleared" | Check Convex declarations table | ⬜ | ⬜ |
| P5.3.3 | `rawPayload` stored verbatim for DMSCLE | Inspect Convex row | ⬜ | ⬜ |

### P5.4 — Route-to-Examine Handling (if DMSROG received)
> If DMSROG is received instead of or before DMSCLE, follow this sub-path:

| ID | Item | Method | Status |
|----|------|--------|--------|
| P5.4.1 | DMSROG (Route to Examine) notification received and saved | Check notifications table | ⬜ |
| P5.4.2 | Declaration status updated to "Action Required" | Check declarations table | ⬜ |
| P5.4.3 | Document upload initiated via `/api/hmrc/documents/initiate` — use MRN | Test via UI or API call | ⬜ |
| P5.4.4 | Document uploaded to HMRC SDE via S3 presigned URL | Check response from upload initiate | ⬜ |
| P5.4.5 | Document linked to declaration via MRN in Convex documents table | Check documents table | ⬜ |
| P5.4.6 | Subsequent DMSCLE received after document upload | Check notifications table | ⬜ |

### P5.5 — Rejection Handling (if DMSREJ received)
> If DMSREJ is received (CDS12050 still active), follow this sub-path:

| ID | Item | Method | Status |
|----|------|--------|--------|
| P5.5.1 | DMSREJ notification received and saved | Check notifications table | ⬜ |
| P5.5.2 | All `<ErrorPointer>` and `<NameCode>` elements extracted from `rawPayload` | Parse raw XML | ⬜ |
| P5.5.3 | Error codes logged to `auditLogs` table | Check auditLogs | ⬜ |
| P5.5.4 | Declaration status updated to "Rejected" | Check declarations table | ⬜ |
| P5.5.5 | Root cause analysis updated in `documentation/TDR_EXECUTION_PLAN.md` P1.3 | Document update | ⬜ |
| P5.5.6 | Return to Phase P1 with updated CDS12050 error detail | Phase re-entry decision | ⬜ |

### P5.6 — Evidence Bundle Assembly
| ID | Item | Files | Status |
|----|------|-------|--------|
| P5.6.1 | Request XML with all headers | `test-evidence/tdr-cds-v1-request.xml` | ⬜ |
| P5.6.2 | 202 Response XML | `test-evidence/tdr-cds-v1-response.xml` | ⬜ |
| P5.6.3 | Scenario summary (Conversation-ID, timestamp, status) | `test-evidence/scenario-summary.json` | ⬜ |
| P5.6.4 | DMSACC notification rawPayload | Export from Convex notifications as `test-evidence/notification-dmsacc.xml` | ⬜ |
| P5.6.5 | DMSCLE notification rawPayload | Export from Convex notifications as `test-evidence/notification-dmscle.xml` | ⬜ |
| P5.6.6 | Pull notification reconciliation result | Save API response as `test-evidence/pull-reconciliation.json` | ⬜ |
| P5.6.7 | Audit log entry for submission | Export from Convex auditLogs as `test-evidence/audit-submission.json` | ⬜ |
| P5.6.8 | All files committed to repository | `git log --oneline test-evidence/` | ⬜ |

## P5 Exit Criteria (Gate P5-EXIT)
- [ ] DMSACC notification received and MRN captured
- [ ] DMSCLE notification received (or DMSROG + document upload path completed)
- [ ] Push and pull notification results reconciled (no discrepancies)
- [ ] No UNKNOWN notification types
- [ ] All P5.6 evidence files committed
- [ ] TDR Run Manager signature: _________________ Date: _____________

---

# PHASE 6 — Amendment Evidence (if required by HMRC)

**Purpose:** Demonstrate the platform can amend a submitted declaration. HMRC may require this as part of the recognition criteria.  
**Owner:** Backend Engineer  
**Target duration:** 2–4 hours

## P6 Entry Criteria
- [ ] P5-EXIT gate passed and signed
- [ ] MRN is confirmed from DMSACC notification

## P6 Checklist

### P6.1 — Amendment Submission
| ID | Item | Method | Status |
|----|------|--------|--------|
| P6.1.1 | Amendment XML uses `FunctionCode = 13` | Code review `amend/route.ts` | ⬜ |
| P6.1.2 | Amendment XML includes `<ID>{MRN}</ID>` | Code review | ⬜ |
| P6.1.3 | Amendment submitted via `/api/hmrc/amend` with valid MRN | API call + 202 response | ⬜ |
| P6.1.4 | New Conversation-ID captured from amendment response | Check response headers | ⬜ |
| P6.1.5 | Declaration status updated to "Amendment Processing" | Check Convex | ⬜ |

### P6.2 — Amendment Notification Evidence
| ID | Item | Status |
|----|------|--------|
| P6.2.1 | DMSACC received for amendment Conversation-ID | ⬜ |
| P6.2.2 | Amendment evidence saved: request + response + notification | ⬜ |

## P6 Exit Criteria (Gate P6-EXIT)
- [ ] Amendment 202 received with valid Conversation-ID
- [ ] DMSACC received for amendment
- [ ] Evidence committed
- [ ] Backend Engineer signature: _________________ Date: _____________

---

# PHASE 7 — Final Evidence Bundle & HMRC Sign-Off

**Purpose:** Assemble the complete evidence package, self-assess against HMRC recognition criteria, and apply for recognised software status.  
**Owner:** TDR Run Manager  
**Target duration:** 1–2 days

## P7 Entry Criteria
- [ ] P5-EXIT (and P6-EXIT if applicable) gate passed and signed

## P7.1 — Evidence Bundle Verification
| ID | Evidence Item | File Location | Status |
|----|--------------|--------------|--------|
| P7.1.1 | Submission request XML | `test-evidence/tdr-cds-v1-request.xml` | ⬜ |
| P7.1.2 | 202 Accepted response | `test-evidence/tdr-cds-v1-response.xml` | ⬜ |
| P7.1.3 | Dry-run preflight results | `test-evidence/tdr-cds-v1-dry-run.json` | ⬜ |
| P7.1.4 | DMSACC notification XML | `test-evidence/notification-dmsacc.xml` | ⬜ |
| P7.1.5 | DMSCLE notification XML | `test-evidence/notification-dmscle.xml` | ⬜ |
| P7.1.6 | Pull reconciliation JSON | `test-evidence/pull-reconciliation.json` | ⬜ |
| P7.1.7 | Audit log entry | `test-evidence/audit-submission.json` | ⬜ |
| P7.1.8 | Scenario summary JSON | `test-evidence/scenario-summary.json` | ⬜ |
| P7.1.9 | Signed P1 Decision Matrix | `documentation/TDR_EXECUTION_PLAN.md` P1.4 | ⬜ |
| P7.1.10 | 27/27 readiness test results | `test-evidence/tdr-readiness-results.json` | ⬜ |
| P7.1.11 | CLAUDE.md committed | Repository root | ⬜ |
| P7.1.12 | Runbook at `documentation/runbook.md` is current | Manual review | ⬜ |

## P7.2 — HMRC Self-Assessment Against Recognition Criteria
| ID | Criterion | Evidence Reference | Status |
|----|-----------|------------------|--------|
| P7.2.1 | Application submits via HMRC CDS API (not direct trader) | tdr-cds-v1-request.xml | ⬜ |
| P7.2.2 | OAuth 2.0 user-restricted authentication | auth/route.ts, OAuth token in submission | ⬜ |
| P7.2.3 | Fraud prevention headers present and correct | hmrc-fetch.ts, headers in request | ⬜ |
| P7.2.4 | End-to-end lifecycle demonstrated (submit → accept → clear) | DMSACC + DMSCLE notifications | ⬜ |
| P7.2.5 | Notification handling works (push and pull) | P5.2 reconciliation | ⬜ |
| P7.2.6 | Error handling demonstrated | 27/27 readiness results | ⬜ |
| P7.2.7 | Rate limiting implemented | rate-limiter.ts + hmrc-fetch.ts | ⬜ |
| P7.2.8 | Runbook and support documentation available | documentation/ folder | ⬜ |
| P7.2.9 | Realistic, non-synthetic data used | Decision matrix + realistic values | ⬜ |
| P7.2.10 | No automated test loops run against TDR | Single submission discipline (this plan) | ⬜ |

## P7.3 — HMRC Application
| ID | Item | Contact | Status |
|----|------|---------|--------|
| P7.3.1 | Email TDR evidence bundle summary to TDRcommunications@hmrc.gov.uk | Include Conversation-ID, MRN, submission timestamp | ⬜ |
| P7.3.2 | Apply for Production API credentials via HMRC Developer Hub | Navigate to application → request promotion to production | ⬜ |
| P7.3.3 | If SDST requests clarification, respond within 2 business days | Monitor inbox | ⬜ |

## P7 Exit Criteria (Gate P7-EXIT)
- [ ] All P7.1 evidence files confirmed and committed
- [ ] Self-assessment P7.2 complete — no gaps
- [ ] HMRC notification email sent
- [ ] Production credentials application submitted
- [ ] TDR Run Manager final signature: _________________ Date: _____________

---

# Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|-----------|--------|-----------|-------|
| R1 | CDS12050 persists after document correction | Medium | Critical | Switch to 6110201000 (previously accepted commodity); escalate to SDST | TDR Run Manager |
| R2 | Convex account interruption during submission window | Low | High | Confirm account health in P0; have fallback direct API test script ready | Platform Owner |
| R3 | HMRC token expires during P4-P5 window | Medium | High | Refresh token in P4 pre-submission; 24h buffer check in P4.1 | Backend Engineer |
| R4 | Webhook not reachable from HMRC (DMSACC never arrives) | Medium | High | Verify endpoint in P0.3.5; use pull API as fallback in P5.2 | Backend Engineer |
| R5 | Synthetic notification re-introduced during debugging | Low | Critical | Evidence Custodian maintains append-only notifications table; P0.2 verification | Compliance Lead |
| R6 | Repeated submissions without gate approval | Low | Critical | This plan is the single gate; no submission without P3-EXIT signature | TDR Run Manager |
| R7 | HMRC TDR environment maintenance window | Low | Medium | Check API status page in P4 pre-submission checklist | TDR Run Manager |
| R8 | Wrong `Gov-Test-Scenario` header causes unexpected routing | Low | High | Confirm `HMRC_TEST_SCENARIO=HAPPY_PATH` in P4.3 | Backend Engineer |

---

# Traceability Matrix

| Requirement | Source | Phase | Test ID(s) | Status |
|-------------|--------|-------|-----------|--------|
| CDS DE 1/1 TypeCode = IMA | TCM v3.92 TDR-R-00001 | P2, P3 | P2.4.7, P3.2.10 | ⬜ |
| CDS DE 1/2 FunctionCode = 9 | TCM v3.92 | P2, P3 | P2.4.6, P3.2.9 | ⬜ |
| CDS DE 1/10 CurrentCode 2-char | TCM v3.92 | P2, P3 | P2.2.1, P2.4.5 | ⬜ |
| CDS DE 1/11 CurrentCode 3-char | TCM v3.92 | P2, P3 | P2.2.2, P2.4.5 | ⬜ |
| CDS DE 2/3 Additional Documents | TCM v3.92 + CDS12050 | P1, P2, P3 | P1.2, P2.2.3, P2.4.2–P2.4.3 | ⬜ |
| CDS DE 3/2 Exporter EORI | TCM v3.92 | P2, P3 | P2.2.5, P3.4.1 | ⬜ |
| CDS DE 3/16 Importer EORI | TCM v3.92 | P2, P3 | P3.4.1 | ⬜ |
| CDS DE 3/18 Declarant EORI | TCM v3.92 | P3 | P3.4.1, P3.2.11 | ⬜ |
| CDS DE 5/8 Country of dispatch | TCM v3.92 | P2, P3 | P2.1.8, P2.4.4, P3.4.4 | ⬜ |
| Fraud prevention headers | HMRC Fraud Prevention API | P3 | P3.3.1–P3.3.12 | ⬜ |
| OAuth user-restricted token | HMRC CDS E2E Guide | P0, P4 | P0.3.2, P4.1 | ⬜ |
| Accept header v1.0+xml | HMRC CDS v1.0 spec | P3 | P3.2.5 | ⬜ |
| Rate limiting (429 handling) | HMRC API policy | P3 | P3 infrastructure | ⬜ |
| Push notification receipt | HMRC CDS E2E Guide | P5 | P5.1.1–P5.1.5 | ⬜ |
| Pull notification reconciliation | HMRC Pull API v1.0 | P5 | P5.2.1–P5.2.4 | ⬜ |
| DMSCLE end-state receipt | HMRC TDR criteria | P5 | P5.3.1–P5.3.3 | ⬜ |
| Evidence integrity (no synthetic data) | Governance breach lesson | P0, P5 | P0.2, P5 notification rules | ⬜ |

---

# Completion Tracking

## Status Codes
| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Complete and verified |
| ❌ | Failed — blocked |
| ⏸️ | Deferred — documented reason required |

## Phase Gate Summary
| Gate | Signed | Date |
|------|--------|------|
| P0-EXIT | | |
| P1-EXIT | | |
| P2-EXIT | | |
| P3-EXIT | | |
| P4-EXIT | | |
| P5-EXIT | | |
| P6-EXIT | | |
| P7-EXIT | | |

---

*This document is the governing authority for all TDR-related decisions. Any deviation from the phase sequence or gate criteria must be documented as an exception with a written justification before proceeding.*
