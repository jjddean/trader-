# Freightcode Delivery Plan

**Goal:** *can a customs agent use this safely in production, and would HMRC consider it operationally sound?*

**Authority:** [`AGENT-SPEC.md`](./AGENT-SPEC.md) — behaviour rules. This doc is status + sequencing only.

**Last reviewed:** 2026-06-12

| Phase | Progress | Blocker |
|-------|----------|---------|
| Phase 1 — HMRC core | ~80% | TDR v1 amend/cancel evidence freeze; status query HTTP 200 |
| Phase 2 — Broker platform | ~75% | Settings OAuth; org RBAC; dashboard stubs |
| Phase 3 — Approval pack | ~40% | Amend/cancel evidence; Playwright smoke-only |

**Core risk:** foundation still moving while product features expand. Stabilize TDR core first.

**Scope today:** import **H1** frontier only (`docs/hmrc/ARCHIVE/trade-test/journey-scope.md`). A real customs broker app needs more — see **Path to Live** below.

---

## Path to Live (HMRC gates + product capabilities)

Code work alone is not “live.” This is the full ladder.

### HMRC / environment gates

| Gate | What it means | Status |
|------|----------------|--------|
| **G0 — Trade Test v2** | Sandbox, Declarations 2.0, TDL data | ✅ ARCHIVE evidence (`FC-MPYAJ7RN`) |
| **G1 — TDR v1** | Sandbox, Declarations 1.0 Beta, real EORI | ✅ DMSACC `FC-MQ8IDIYS` — evidence frozen |
| **G2 — SDST sign-off** | CDS ODT (+ S&S when in scope) returned; production subs confirmed | 🟡 ODT **sent** — awaiting SDST reply; S&S later |
| **G3 — Production credentials** | `api.service.hmrc.gov.uk` + production OAuth | ⬜ Pending after SDST |
| **G4 — TDR on production host** | v1 Declarations on live API with real traders | ⬜ After G3 |
| **G5 — CDS Live** | Recognised path; Declarations **v2.0** on production (`environment-matrix.md`) | ⬜ Future |

### Product capabilities (what brokers actually need)

| Capability | Needed for live brokers? | Status | Notes |
|------------|-------------------------|--------|-------|
| **Import H1 (CDS)** | Yes — core | 🟡 | Submit/amend/cancel/notifications; one lane |
| **Duty / tax (DMSTAX)** | Yes | 🟡 | Parser + UI label only; no payment workflow |
| **Duty payment** (DAN, deferment, cash, guarantee) | Yes | ⬜ | DE refs in `cds_h1_data_elements.ts`; no live DAN/guarantee mapping; reports page has placeholder DAN |
| **Payment rails** (pay HMRC / broker collects) | Yes | ⬜ | Stripe = SaaS subscription only; duty payment in R&D (`documentation/R_and_D/`) |
| **Export declarations** | Yes (many brokers) | ⬜ | `journey-scope.md`: deferred — separate CPC/lane/mapper |
| **ENS / Safety & Security import** | Yes (EU import) | ⬜ | SDST enabled S&S APIs Apr 2026; no product; SS-GB checklist N/A for now |
| **H2 / warehousing / supplementary** | Some clients | ⬜ | Deferred in journey-scope |
| **Inventory linking (IL) exports** | Export + IL clients | ⬜ | ODT: N/A |
| **Quota / CAP / security deposit** | Some commodities | ⬜ | Runbook out-of-scope for TT |
| **Multi-user org / CRM** | Yes | 🟡 | Workspace schema; not wired |
| **Billing (SaaS)** | Yes | 🟡 | Stripe connected; not duty billing |

### Recommended build order (after G1 frozen)

```
NOW        G2 — Await SDST reply (CDS ODT emailed)
           G1 — ✅ TDR v1 evidence frozen (`FC-MQ8IDIYS`)

NEXT       Finish import H1 on TDR (amend scope, evidence, regression CI)
           Duty: DMSTAX → store amounts → display on declaration (no payment yet)

THEN       G3–G4 — Production host + TDR with real traders (HMRC-led)
           Org RBAC, CRM, operational monitoring

PRODUCT    Pick ONE expansion at a time (each = new lane + spec + evidence):
           A) Duty payment / deferment (DAN, guarantee DEs)
           B) Export declarations (new mapper lane)
           C) ENS / S&S (SS-GB checklist + APIs Agne enabled)
           D) H2 / warehousing

LIVE       G5 CDS Live when HMRC directs (likely v2 Declarations on production)
```

Do not start B/C/D until import H1 is frozen on TDR.

---

## Next — P0 only (unchecked until done)

- ✅ Log TDR DMSACC in [`errors-handled.md`](./errors-handled.md) (`FC-MQ8IDIYS` / `26GB6DTVT5133M7AR0`)
- ✅ Freeze TDR request XML → `evidence/passing-payload.xml`
- [ ] Resolve env doc conflict (matrix vs AGENT-SPEC vs runbook)
- 🟡 TDR amend evidence run → `evidence/amend/` (DMSRES `26GB6GDX92A21TIAR0` on TT v2 — re-run on v1 + freeze XML)
- [ ] TDR cancel evidence run → `evidence/cancel/`
- [ ] Wire HMRC OAuth in Settings
- [ ] Mount workspace provider; scope declarations to org
- [ ] CI: `npm run test:h1` + dry-run scenario on PR
- [ ] Security policy (1-pager)
- [ ] Backup / recovery policy (1-pager)
- [ ] Playwright: authenticated dry-run
- [ ] Complete DE mapping for active lane fields only

---

## Done

### Track 1 — HMRC Compliance

- ✅ WCO 3.6 XML generation — `wco-mapper.ts`, `h1-xml-renderer.ts`
- ✅ Declarations API v1.0 (TDR sandbox DMSACC 2026-06-10)
- ✅ Submit flow — `submit/route.ts`
- ✅ Cancel flow — `cancel/route.ts`
- ✅ File upload (SDE) — `documents/initiate/route.ts`
- ✅ Push notifications — `webhooks/notify/route.ts`
- ✅ Pull notifications — `notifications/pull/route.ts` (`declarationId` multi-conversation), `convex/hmrc.ts`
- ✅ Conversation ID persistence
- ✅ MRN lifecycle — `notifications.ts` `saveWebhook`
- ✅ DMSACC / DMSREJ handling — `notification_status.ts`
- ✅ Retry on 429 / 5xx — `hmrc-fetch.ts`
- ✅ Submit idempotency — `beginSubmission`
- ✅ Pre-submit validation gate — rule engine + preflight + code lists
- ✅ OAuth + token refresh — auth + callback routes, `hmrc-token.ts`
- ✅ Appendix 16C goods location — `goods-location.ts`
- ✅ Goods location DE 5/23 split shape
- ✅ Procedure codes 4000/000
- ✅ Goods item structure (weight, value, packaging, origin)
- ✅ Correct Accept headers (v1.0 TDR)
- ✅ Correct API hosts (sandbox / production)
- ✅ Fail-closed dry-run
- ✅ DE 8/5 `transactionNatureCode` — schema, UI, rules, mapper
- ✅ Production mapper in scenario runner + `debug-payload.js`

### Track 2 — Production Platform

- ✅ Request/response evidence store — `convex/submissions.ts`
- ✅ Notification audit trail — immutable `notifications` table
- ✅ User action audit log — `convex/audit.ts`
- ✅ Resubmit tracking — submissions timeline + dedupe
- ✅ Webhook verification — Bearer token on notify route
- ✅ Outbound HMRC rate limiting — `rate-limiter.ts`
- ✅ Owner-scoped declaration access
- ✅ Session security — Clerk

### Track 3 — Broker Workflow

- ✅ Declaration list + search
- ✅ Core schema editor
- ✅ Goods item editor
- ✅ Submit + dry-run UI
- ✅ Status timeline (notifications + audit)
- ✅ HMRC secure document upload UI
- ✅ Document hub
- ✅ Document ↔ item linkage
- ✅ OCR / AI invoice extract

### Track 4 — AI & Intelligence

- ✅ Pre-submit rule engine — `rule_engine.ts`, 9+ seeded rules
- ✅ Completeness scoring — `declaration_completeness.ts`
- ✅ AI assistant (explain-only)

### Testing

- ✅ H1 unit tests — 54 tests (mapper, XML, notifications, goods-location, file-upload)
- ✅ Dry-run scenario runner — `test-evidence/run-hmrc-scenarios.js`

### Documentation

- ✅ AGENT-SPEC (behaviour authority)
- ✅ Environment matrix
- ✅ Ops runbook (partial)
- ✅ TT baseline frozen in ARCHIVE (`FC-MPYAJ7RN` / `passing-payload.xml`)
- ✅ TDR v1 DMSACC frozen in ACTIVE (`FC-MQ8IDIYS` / `evidence/passing-payload.xml`)
- ✅ CDS production ODT emailed to SDST — awaiting reply

---

## In progress — finish these

### Track 1 — HMRC Compliance

- 🟡 Amend flow — DMSRES proven in app (`26GB6GDX92A21TIAR0`); dedicated `/amend` endpoint; TDR v1 evidence freeze pending
- [ ] Amend/cancel idempotency — no atomic claim
- [ ] DE mapping docs — 5 files in `mapping/`; active lane incomplete
- [ ] Appendix 5A document validation — partial via rules
- [ ] Appendix 21A obligations — completeness only, not full matrix
- [ ] Environment separation — code OK; docs conflict (see below)
- [ ] Currency + valuation — incoterm-conditional; not all paths covered
- [ ] Document codes DE 2/3 — N935 + N271 only
- [ ] Machine validation in code — rule engine + mapper; gaps remain
- [ ] DMSREJ evidence — ARCHIVE complete; ACTIVE empty (no TDR rejections yet)
- [ ] Secure secret storage — env-based; no runbook
- [ ] Cross-environment submit guard — manual discipline only

**Env doc conflict (resolve as part of above):**

| Source | Says |
|--------|------|
| `environment-matrix.md` | Sandbox + `NEXT_PUBLIC_HMRC_ENV=tdr` — active now |
| `AGENT-SPEC.md` §2 | TDR on production host |
| `hmrc-operations-runbook.md` | `HMRC_ENVIRONMENT=production` for TDR |
| `CLAUDE.md` | Lists `HMRC_DECLARATIONS_ACCEPT` explicitly |

### Track 2 — Production Platform

- [ ] Declaration versioning — snapshots in submissions; no revision field
- [ ] Workspace / org RBAC — schema exists; not on HMRC routes; provider not mounted
- [ ] Admin audit console — exists; not user-facing
- [ ] Secure document storage — Convex + S3; R2 partial; no retention policy
- [ ] Encryption / secrets — platform defaults; no doc
- [ ] Rate limiting — outbound only; no inbound API limits
- [ ] Role-based access — owner + admin; no org roles on HMRC

### Track 3 — Broker Workflow

- [ ] Dashboard — KPIs/chart stubs
- [ ] Settings — HMRC OAuth (connect is on dashboard only; submit page references Settings)
- [ ] Settings — security/notifications placeholders
- [ ] Reporting / financial records — pages exist; data quality depends on submissions

### Track 4 — AI & Intelligence

- [ ] "Likely DMSREJ" prevention — rules cover subset; not full CDS catalog
- [ ] Explainable validation — rule messages; not DE-cited everywhere
- [ ] HS code lookup — static JSON + HMRC action; Typesense is companies-only
- [ ] UK Global Tariff — calculator + preference engine; not production-complete
- [ ] FTA / preference engine — UI + engine; not fully wired
- [ ] Duty savings — `savingsEstimate` schema field never written
- [ ] GIR / classification audit — endpoint exists; not production pipeline

### Phase 3 — Approval pack

- ✅ Submit evidence — `ACTIVE/tdr/evidence/submit/` (`FC-MQ8IDIYS`)
- [ ] Amend / cancel / notification / file-upload evidence — ARCHIVE only
- [ ] Status query evidence — not in ACTIVE pack
- ✅ Error handling examples — ACTIVE `errors-handled.md` (DMSACC row)
- [ ] Architecture diagram
- [ ] Operational procedures — runbook partial
- [ ] Controlled test scenarios — runner exists; no scenario catalog
- [ ] Regression CI — unit tests yes; no golden XML gate on PR
- ✅ Frozen TDR passing payload — `ACTIVE/tdr/evidence/passing-payload.xml`
- [ ] Versioned mapping rules — git-tracked; no version tags

**Missing docs** (listed in README, not on disk):

- `CDS_Declaration_Specifications.md`
- `internal-guidance/h1-operational-invariants.md`
- `hmrc-integration-plan.md`

### Testing

- [ ] Playwright — 3 smoke tests only; no auth or submit flow

---

## Not started

### Path to Live — product (beyond import H1 code)

- [ ] Duty amounts from DMSTAX stored and shown per declaration
- [ ] Deferment account (DAN) / guarantee DE mapping + validation
- [ ] Duty payment workflow (deferment vs immediate — product + compliance decision)
- [ ] Payment integration for duty (separate from Stripe SaaS billing)
- [ ] Export declaration category (new lane + mapper + evidence)
- [ ] ENS / Safety & Security import (SS-GB checklist + S&S APIs)
- [ ] H2 / supplementary declarations
- [ ] Inventory linking exports
- [ ] Production OAuth + `api.service.hmrc.gov.uk` cutover
- [ ] CDS Live v2.0 migration (post-TDR)

### Track 1 — HMRC Compliance

- [ ] XSD / full schema validation (`validateXmlPreflight` is structural only)
- [ ] TDR amend/cancel evidence in ACTIVE
- [ ] Authorisations DE 64A (not in active lane)

### Track 2 — Production Platform

- [ ] Inbound API rate limiting
- [ ] Error monitoring / alerts
- [ ] Backup / DR documentation

### Track 3 — Broker Workflow

- [ ] Global notifications inbox
- [ ] Customer / importer CRM
- [ ] Declaration templates (lane reuse)
- [ ] Bulk import / export
- [ ] Onboarding / help UX

### Track 4 — AI & Intelligence

- [ ] Confidence scoring + human-in-the-loop review
- [ ] Evaluation / training datasets

### Phase 3 — Approval pack

- [ ] Security description (standalone doc)

---

## Sequence

```
Week 1–2   STABILIZE CORE
           Record DMSACC + freeze ACTIVE payload
           Resolve env docs
           Settings HMRC OAuth
           Amend/cancel TDR evidence (one each)

Week 3–4   HARDEN COMPLIANCE
           DE mapping for active lane only
           XSD or HMRC validator (if sandbox-side)
           Amend: one change kind at a time + evidence
           CI golden XML regression

Week 5–6   AUDIT + RBAC
           Workspace provider + org-scoped declarations
           HMRC routes enforce workspace role
           ACTIVE evidence pack complete
           Security + backup runbooks

Week 7+    PRODUCT (after core frozen)
           Customer/importer management
           Dashboard KPIs + duty savings write-back
           Global notifications inbox
           Playwright full flow
```

---

## Priority tiers

| Tier | When |
|------|------|
| **P0** | HMRC gates G1–G2 — G1 done; G2 awaiting SDST reply |
| **P1** | Import H1 broker-ready — org RBAC, duty display, Settings OAuth, CRM |
| **P2** | Live expansion — export, ENS, duty payment rails (one at a time) |
| **P3** | G3–G5 production host + CDS Live v2 |

**HMRC cares about:** correct XML, notifications, evidence, stability (per gate).

**Brokers care about:** import + **duty visibility/payment**, export, ENS, team workflow, documents.

Finish **import H1 + SDST** before export/ENS/payment expansion.

---

## References

| Doc | Purpose |
|-----|---------|
| [`AGENT-SPEC.md`](./AGENT-SPEC.md) | Behaviour rules |
| [`environment-matrix.md`](./environment-matrix.md) | API versions, hosts, Accept |
| [`errors-handled.md`](./errors-handled.md) | TDR rejection log |
| [`mapping/`](./mapping/) | DE mapping |
| [`../ARCHIVE/trade-test/`](../ARCHIVE/trade-test/) | TT reference only — not ACTIVE proof |

---

*When an item completes: tick it in **Next** or move from **In progress** / **Not started** to **Done**. Do not treat ARCHIVE as ACTIVE TDR proof.*

