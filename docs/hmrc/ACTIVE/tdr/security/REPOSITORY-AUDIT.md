# Repository Audit — HMRC Readiness

**Date:** 2026-06-14  
**Auditor:** Automated readiness review (AI-assisted static audit)  
**Principle:** Controlled engineering — preserve development history; do not fake an empty repo.

**Snapshot only.** Live index is [`../BACKLOG.md`](../BACKLOG.md). Live CI is `.github/workflows/tdr-regression.yml`. Do not execute this file as a task list.

---

## Classification key

| Class | Meaning |
|-------|---------|
| **A — Production** | Required for running Freightcode in TDR/production |
| **B — Development tooling** | Build, train, deploy helpers — not runtime |
| **C — Test / evidence** | HMRC scenario scripts, dry-run outputs, SDST packs |
| **D — Archive / obsolete** | Superseded, retired, or scratch — move or ignore |

---

## 1. Repository hygiene summary

| Metric | Count | Notes |
|--------|-------|-------|
| Tracked source files (approx.) | ~400+ TS/TSX | Core app healthy |
| Uncommitted `tmp/` scratch | ~115 files | Not in git; should stay out |
| Duplicate doc trees | 2 | `docs/hmrc/` (canonical) vs `documentation/` (legacy R&D) |
| Abandoned Convex modules (removed in latest commit) | 5 | `ai.ts`, `archive.ts`, `compliance.ts`, `assistantActions.ts`, `getFirstLane.ts` — correctly deleted |
| CI workflows | 1 | `tdr-regression.yml` |

---

## 2. Critical hygiene findings

### R-01 — Root README is not a project orientation doc

| Field | Value |
|-------|-------|
| **File** | `README.md` (repo root) |
| **Issue** | Contains Convex database export instructions, not Freightcode project overview. External reviewers landing on GitHub see wrong content. |
| **Severity** | High (presentation) |
| **Recommended action** | Replace with proper README: stack, setup, `npm run dev`, HMRC doc pointer, test commands. Move Convex export note to `convex/README.md` if needed. |
| **Decision** | **KEEP path; rewrite content** |

---

### R-02 — `tmp/` directory is uncontrolled scratch space

| Field | Value |
|-------|-------|
| **Path** | `tmp/` (~115 files) |
| **Issue** | ODT packaging experiments, HMRC OAS JSON dumps, Convex debug JSON, XSD extracts, Python one-offs. Mix of PII-adjacent debug (`convex-identity.json`) and large binary zips. Not gitignored (only LoRA/kaggle patterns added recently). |
| **Severity** | Medium |
| **Recommended action** | Add `/tmp/` to `.gitignore`. Keep locally for SDST work; do not commit. Optionally symlink useful OAS mirrors to `docs/hmrc/specs/` if still referenced. |
| **Decision** | **ARCHIVE locally; gitignore** |

---

### R-03 — Large generated datasets in git

| Field | Value |
|-------|-------|
| **Path** | `lora-dataset/train-autotrain.csv` (144k lines), `lora-dataset/train.csv`, `lora-dataset/eval.csv` |
| **Issue** | ~160k lines of generated training data committed. Violates workspace rule #7 (large datasets → R2 pointers) for runtime data; acceptable for ML pipeline but heavy for repo. |
| **Severity** | Low (ops) |
| **Recommended action** | Long-term: store in R2/HuggingFace; keep manifest + sample in repo. Short-term: acceptable for HMRC review (shows ML capability). |
| **Decision** | **KEEP** (documented exception for LoRA pipeline) |

---

### R-04 — Duplicate / conflicting documentation trees

| Path | Status | Decision |
|------|--------|----------|
| `docs/hmrc/` | **Canonical** — AGENT-SPEC, DELIVERY-PLAN, evidence, specs | KEEP |
| `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` | Single source of truth for HMRC behaviour | KEEP |
| `documentation/HMRC/README.md` | Marked "Retired" — points to AGENT-SPEC | ARCHIVE (already retired) |
| `documentation/hmrc_tdr_audit/README.md` | Marked "Retired" | ARCHIVE |
| `documentation/R_and_D/*` | Privacy, terms, security policies, architecture — useful for HMRC production questions but not in canonical tree | KEEP; link from future root README |
| `convex/README.md` | Default Convex scaffold template | KEEP; update or note as scaffold |
| `spec/HANDOVER.md` | Empty (1 line) | KEEP or populate |
| `spec/README.md` | Exists | KEEP |

**Removed in recent commit (correct):** `docs/hmrc/ACTIVE/tdr/README.md`, `docs/hmrc/ACTIVE/tdr/CHECKLIST.md`, `docs/hmrc/CHECKLISTS.md` — consolidated into DELIVERY-PLAN + AGENT-SPEC.

---

### R-05 — Abandoned / removed UI and API surfaces

| File | Issue | Decision |
|------|-------|----------|
| `src/app/api/hmrc/upload/route.ts` | Deleted (14 lines) — upload moved to documents/initiate | DELETE ✓ (done) |
| `src/app/dashboard/tools/calculator/page.tsx` | Removed | DELETE ✓ (done) |
| `src/app/dashboard/tools/dcts/page.tsx` | Removed | DELETE ✓ (done) |
| `src/app/dashboard/tools/roo-simulator/page.tsx` | Removed | DELETE ✓ (done) |
| `src/app/dashboard/support/page.tsx` | Removed | DELETE ✓ (done) |
| `src/app/dashboard/documents/components/*` (ChatSidebar, PreferenceChecker, RulesOfOriginSimulator) | Removed legacy AI/doc components | DELETE ✓ (done) |

---

### R-06 — `cloudagent/` subdirectory

| Field | Value |
|-------|-------|
| **Path** | `cloudagent/` |
| **Issue** | Separate Cloudflare Workers agent with own scripts, wrangler tmp bundles. Excluded from root `tsconfig.json`. Appears to be parallel experiment for tariff/DCTS edge fetching. |
| **Severity** | Low |
| **Recommended action** | Document relationship in root README or `cloudagent/README.md`. Ensure not deployed to production path accidentally. |
| **Decision** | **KEEP** (B — development/experimental edge tooling) |

---

### R-07 — Kaggle / LoRA debug artifacts (gitignored after latest commit)

| Path | Decision |
|------|----------|
| `.kaggle-kernel-debug*/` | IGNORE (gitignore added) |
| `.kaggle-pull-test/` | IGNORE |
| `lora-output-kaggle-test/` | IGNORE |
| `scripts/lora/` | KEEP (B — ML pipeline) |

---

## 3. Production code map (Class A)

```
src/
├── app/
│   ├── api/hmrc/          # HMRC proxy (submit, amend, cancel, status, webhooks, documents)
│   ├── api/ai/              # AI routes (Groq/Textract)
│   ├── api/stripe/          # Billing portal
│   ├── dashboard/           # Main SaaS UI
│   └── ...
├── components/              # UI components
├── lib/
│   ├── hmrc-fetch.ts        # HMRC HTTP wrapper
│   ├── hmrc-config.ts       # Env matrix
│   ├── wco-mapper.ts        # DE mapping
│   ├── h1-xml-renderer.ts   # XML generation
│   └── ...
└── proxy.ts                 # Clerk middleware (Next.js 16)

convex/
├── declarations.ts          # Core declaration CRUD + read models
├── goods_items.ts           # Item CRUD
├── notifications.ts         # Immutable HMRC notifications
├── hmrc.ts / hmrc_actions.ts
├── schema.ts
└── ...

tests/h1/                    # Unit + golden XML regression
scripts/tdr-dry-run.mjs      # Merge gate dry-run
```

---

## 4. Evidence preservation (Class C — do not delete)

| Path | Purpose |
|------|---------|
| `docs/hmrc/ACTIVE/tdr/evidence/` | TDR sandbox XML, LOG.md, amend/cancel/status/pull/file-upload |
| `docs/hmrc/ARCHIVE/trade-test/` | Trade Test v2 historical evidence + SDST pack |
| `test-evidence/` | Scenario runners, ODT fill scripts, debug payloads |
| `tests/h1/tdr-golden-xml.test.ts` | Regression gate |
| `.github/workflows/tdr-regression.yml` | CI evidence of automated gates |

---

## 5. Documentation structure assessment

| Check | Status |
|-------|--------|
| Root README is main orientation | ❌ **Fail** — Convex export placeholder |
| HMRC one source of truth | ✓ `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` |
| Old docs in archive | ✓ `docs/hmrc/ARCHIVE/trade-test/` |
| Conflicting READMEs | ⚠️ `documentation/HMRC/` retired but still present; `docs/hmrc/README.md` is correct index |
| Delivery plan | ✓ `DELIVERY-PLAN.md` (item 7 = ops policies before production) |

**Recommended doc actions (no deletions):**

1. Rewrite root `README.md`
2. Add `docs/hmrc/ACTIVE/tdr/security/` index line to `docs/hmrc/README.md`
3. Link `documentation/R_and_D/privacy_policy.md` and `terms_of_service.md` from root README when URLs are live

---

## 6. HMRC integration review

| Check | Status | Evidence |
|-------|--------|----------|
| HMRC calls server-side only | ✓ | `fetchHmrc()` in `src/lib/hmrc-fetch.ts`; browser calls `/api/hmrc/*` only |
| Sandbox/production separation | ✓ | `HMRC_ENVIRONMENT`, `hmrc-config.ts`, `environment-matrix.md` |
| Error handling | ✓ | Submit route preflight + audit logging |
| Declaration lifecycle | ✓ | Status page, notifications, amend/cancel routes |
| Status polling | ✓ | `status-query/route.ts`, scheduled pulls in `hmrc_actions.ts` |
| Webhook handling | ✓ | `webhooks/notify/route.ts` + `notifications.saveWebhook` |
| Evidence logging | ✓ | `docs/hmrc/ACTIVE/tdr/evidence/LOG.md`, `submissions` table, audit logs |
| Dry-run gate | ✓ | `scripts/tdr-dry-run.mjs`, submit route `dryRunOnly` |
| Fraud prevention headers | ✓ | Submit route validates client headers |

---

## 7. CI / quality gates

| Gate | Status |
|------|--------|
| `npm run test:tdr` | ✓ 67/67 pass |
| `npx tsc --noEmit` | ✓ Clean |
| `npm run lint` | ❌ Broken (eslint flat config) |
| `npm run build` | ✓ In CI |
| `npm audit` | ❌ 28 vulnerabilities |
| Playwright E2E | Not in CI yet (DELIVERY-PLAN item 6) |

---

## 8. Recommended `.gitignore` additions

```
/tmp/
/documentation/hmrc_tdr_audit/   # optional — if fully retired
```

(Current `.gitignore` already covers LoRA/kaggle debug patterns.)
