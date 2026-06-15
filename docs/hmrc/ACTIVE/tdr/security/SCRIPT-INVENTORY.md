# Script Inventory — Classification for HMRC Readiness

**Date:** 2026-06-14  
**Rule:** Do not remove scripts that provide audit evidence.

---

## Classification legend

| Tag | Meaning |
|-----|---------|
| **KEEP** | Required for production, deployment, HMRC testing, or CI |
| **ARCHIVE** | One-off / completed / debugging — retain for history, not daily use |
| **DELETE** | Broken duplicate, generated artifact, or safe to remove |
| **IGNORE** | Local-only; gitignored |

---

## `scripts/` (root)

| Script | Purpose | Tag | Notes |
|--------|---------|-----|-------|
| `scripts/tdr-dry-run.mjs` | TDR v1 dry-run preflight gate | **KEEP** | Merge gate; CI runs this |
| `scripts/generate-training-data.mjs` | LoRA dataset generation | **KEEP** | B — ML pipeline |
| `scripts/build-appendix-16c-codes.js` | Appendix 16C goods location codes | **KEEP** | Reference data build |
| `scripts/parse-hmrc-data.mjs` | HMRC data parsing | **ARCHIVE** | One-off ingestion |
| `scripts/fetch-hmrc-bulk.mjs` | Bulk HMRC data fetch | **ARCHIVE** | Data ingestion |
| `scripts/refresh-hmrc-companies.mjs` | Company directory refresh | **ARCHIVE** | Periodic ops |
| `scripts/index-hmrc-companies.mjs` | Index companies to search | **ARCHIVE** | Typesense indexing |
| `scripts/sync-companies-to-r2.mjs` | R2 sync for companies | **KEEP** | Edge data layer |
| `scripts/verify-r2.mjs` | R2 connectivity check | **KEEP** | Ops verification |
| `scripts/verify-search.mjs` | Typesense search check | **KEEP** | Ops verification |
| `scripts/search-demo.mjs` | Search demo | **ARCHIVE** | Dev demo |
| `scripts/build-dcts-top-importers.mjs` | DCTS analytics build | **ARCHIVE** | Data build |
| `scripts/update-currency.mjs` | Currency rate update | **KEEP** | Reference data |
| `scripts/generate-sample-data.mjs` | Sample declaration data | **ARCHIVE** | Dev seeding |
| `scripts/create-test-user.js` | Clerk test user creation | **KEEP** | HMRC/E2E testing |
| `scripts/upload_hf.py` | HuggingFace upload | **ARCHIVE** | LoRA deploy |
| `scripts/upload_hf.ps1` | HuggingFace upload (PS) | **ARCHIVE** | Duplicate of .py |
| `scripts/import-fix-plan-to-github-project.ps1` | GitHub project import | **ARCHIVE** | One-off PM |
| `scripts/extract_hmrc_cds_spec.py` | CDS spec extraction | **ARCHIVE** | Spec tooling |
| `scripts/generate_hmrc_tdr_audit.py` | TDR audit doc generation | **ARCHIVE** | Evidence generation |
| `scripts/data_ingestion/mock_directory_scraper.py` | Mock scraper | **ARCHIVE** | Experiment |
| `scripts/typesense/provision.ts` | Typesense provisioning | **KEEP** | Deployment |
| `scripts/typesense/terminate.ts` | Typesense teardown | **KEEP** | Deployment |

---

## `scripts/lora/` (ML pipeline — Class B)

| Script | Purpose | Tag |
|--------|---------|-----|
| `bootstrap.py` | LoRA env bootstrap | **KEEP** |
| `pipeline.py` | Train/wait/download orchestration | **KEEP** |
| `validate_dataset.py` | Dataset validation | **KEEP** |
| `convert_dataset.py` | Dataset format conversion | **KEEP** |
| `train_unsloth.py` | Unsloth training | **KEEP** |
| `train_tinker.py` | Tinker API training | **KEEP** |
| `train_hf_spaces.py` | HF Spaces training | **KEEP** |
| `kaggle_train.py` | Kaggle kernel training | **KEEP** |
| `colab_open.py` | Open Colab notebook | **KEEP** |
| `run.mjs` | Colab bundle + deploy runner | **KEEP** |
| `download_adapters.py` | Download trained adapters | **KEEP** |
| `upload_dataset.py` | Upload dataset to HF | **KEEP** |
| `wait_for_training.py` | Poll training status | **KEEP** |
| `check_hf_token.py` | HF token validation | **KEEP** |
| `env.py` | Shared env helpers | **KEEP** |
| `dataset_readme.py` | Generate dataset README | **KEEP** |
| `Train_HS_Classifier.ipynb` | Colab notebook | **KEEP** |
| `kaggle/train_kernel.py` | Kaggle kernel script | **KEEP** |
| `kaggle/train_kernel.ipynb` | Kaggle notebook | **KEEP** |
| `kaggle/*.json` | Kaggle metadata | **KEEP** |
| `__pycache__/*.pyc` | Python bytecode | **DELETE** / gitignore |

---

## `test-evidence/` (HMRC evidence — Class C)

| Script | Purpose | Tag | Notes |
|--------|---------|-----|-------|
| `run-hmrc-scenarios.js` | Archived TT dry-run runner | **KEEP** | Output → `docs/hmrc/ARCHIVE/trade-test/evidence/` |
| `run-additional-scenarios.js` | Extended scenario runner | **KEEP** | HMRC testing |
| `query-declaration-information-status.js` | Status query evidence | **KEEP** | TDR evidence |
| `initiate-file-upload.js` | File upload evidence | **KEEP** | TDR evidence |
| `try-cancel-mrn.js` | Cancel scenario | **KEEP** | TDR evidence |
| `try-cancel-variants.js` | Cancel variants | **KEEP** | TDR evidence |
| `fill-cds-odt.js` | SDST ODT form fill | **KEEP** | SDST evidence pack |
| `debug-odt-row.js` | ODT row debugging | **ARCHIVE** | SDST session debug |
| `debug-payload.js` | Payload debug | **ARCHIVE** | Uses `getForDebug` Convex query |
| `debug-payload.ps1` | PowerShell payload debug | **ARCHIVE** | Duplicate approach |
| `package-odt.py` | ODT packaging | **KEEP** | SDST evidence |
| `verify-filled-odt.py` | ODT verification | **KEEP** | SDST evidence |
| `debug-payload.xml` | Frozen debug XML | **KEEP** | Evidence artifact |
| `debug-report.json` | Debug output | **ARCHIVE** | Session artifact |
| `HMRC-EVIDENCE-MOVED.md` | Relocation note | **KEEP** | Provenance |
| `maritime16c.ods` / `appendix16c.ods` | Reference spreadsheets | **KEEP** | Mapping reference |

---

## `cloudagent/scripts/` (edge agent — Class B)

| Script | Purpose | Tag |
|--------|---------|-----|
| `deploy.mjs` | Cloudflare deploy | **KEEP** |
| `fetch-uk-tariff.mjs` | UK tariff fetch | **KEEP** |
| `fetch-dcts-rules.mjs` | DCTS rules fetch | **KEEP** |
| `prep-cloudflare-data.mjs` | Data prep for edge | **KEEP** |
| `seed-d1.mjs` | D1 database seed | **KEEP** |
| `index-companies.mjs` | Company indexing | **KEEP** |
| `embed-dcts-rules.ts` | Vector embeddings | **ARCHIVE** |
| `convert-dcts-data.mjs` | DCTS conversion | **ARCHIVE** |
| `migrate-vectorize.ps1` | Vectorize migration | **ARCHIVE** | Completed migration |
| `diagnose-1031.mjs` | RPC diagnose | **ARCHIVE** | Debug |
| `diagnose-rpc.mjs` | RPC diagnose | **ARCHIVE** | Debug |
| `diagnose-rpc-ws.mjs` | WebSocket RPC diagnose | **ARCHIVE** | Debug |
| `test-url-patterns.mjs` | URL pattern test | **ARCHIVE** | Debug |
| `test-agent.mjs` | Agent test | **ARCHIVE** | Debug |

---

## `tmp/` (scratch — not in git)

| Pattern | Tag | Action |
|---------|-----|--------|
| `tmp/odt-*` | **ARCHIVE** | Local SDST session; gitignore |
| `tmp/*-oas.json`, `tmp/*.html` | **ARCHIVE** | API spec mirrors; optional move to `docs/hmrc/specs/` |
| `tmp/convex-*.json` | **DELETE** local | Debug only; never commit |
| `tmp/*.py`, `tmp/*.js` | **ARCHIVE** | One-off experiments |
| `tmp/cds-tech-docs-extract/` | **ARCHIVE** | Large HMRC doc extract |
| `tmp/hmrc_tdr_audit/` | **ARCHIVE** | Audit working files |

---

## Root-level scripts

| Script | Purpose | Tag |
|--------|---------|-----|
| `generate-training-data.mjs` | Root LoRA data gen (duplicate path?) | **KEEP** | Also under scripts/ pattern |
| `test-evidence/run-hmrc-scenarios.js` | Primary TT runner | **KEEP** |

---

## `package.json` npm scripts (runtime entry points)

| Script | Tag | HMRC relevance |
|--------|-----|----------------|
| `dev` / `build` / `start` | **KEEP** | Production |
| `test:h1` | **KEEP** | TDR regression |
| `test:tdr` / `test:tdr-dry-run` | **KEEP** | Merge gate |
| `test:e2e` | **KEEP** | Planned CI (item 6) |
| `lint` | **KEEP** | Broken — needs fix |
| `lora:*` (15 scripts) | **KEEP** | ML pipeline (B) |

---

## Summary counts

| Tag | Approx. count |
|-----|---------------|
| KEEP | 45 |
| ARCHIVE | 25 |
| DELETE | 3 (`__pycache__`, local tmp debug) |
| IGNORE | 6 (`.kaggle-kernel-debug*`, etc.) |

---

## Scripts that must not be deleted (audit evidence)

1. `scripts/tdr-dry-run.mjs`
2. `test-evidence/run-hmrc-scenarios.js`
3. `test-evidence/fill-cds-odt.js`
4. `test-evidence/query-declaration-information-status.js`
5. `test-evidence/initiate-file-upload.js`
6. `test-evidence/try-cancel-*.js`
7. All files under `docs/hmrc/ACTIVE/tdr/evidence/`
8. All files under `docs/hmrc/ARCHIVE/trade-test/`
