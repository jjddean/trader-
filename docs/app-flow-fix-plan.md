# App Flow Fix Plan Checklist

## 1) Unify Submit Gate With Persisted Document Requirements
- [x] **Severity:** Critical
- [x] **Estimated Effort:** Medium (0.5-1 day)
- [x] **Root Cause:** Submit validation currently gates on per-item `additionalDocuments` while the new requirements engine persists truth in `document_requirements`.
- [x] **Corrective Actions:**
  - [x] Read `document_requirements` in submit flow for the active declaration.
  - [x] Block submit when any required document is `missing`.
  - [x] Display explicit missing requirement codes in pre-flight panel.
  - [x] Hydrate shipment-rule requirements in submit flow so gate works even if `/dashboard/documents` was never visited.
- [x] **Success Criteria:**
  - [x] Submit button is disabled when required docs are missing.
  - [x] Missing requirement codes are visible to user before submit.
  - [x] Same declaration passes/fails consistently across Documents and Submit pages.

## 2) Retire Legacy Declaration-Scoped Documents Flow
- [x] **Severity:** Critical
- [x] **Estimated Effort:** Small-Medium (0.5 day)
- [x] **Root Cause:** Two parallel document flows exist (`/dashboard/documents` and `/dashboard/declarations/[id]/documents`) with divergent logic and upload pathways.
- [x] **Corrective Actions:**
  - [x] Redirect `/dashboard/declarations/[id]/documents` to unified `/dashboard/documents`.
  - [x] Preselect declaration filter in unified page via query param to preserve context.
  - [x] Keep side-effect free UX (no duplicate writes, no double hydration loops).
- [x] **Success Criteria:**
  - [x] Opening old route lands in unified docs page with declaration preselected.
  - [x] No user can continue using old isolated upload workflow.
  - [x] Upload/requirements/template actions all operate on one consistent flow.

## 3) Define Blocking vs Advisory Rules
- [x] **Severity:** High
- [x] **Estimated Effort:** Medium (1 day)
- [x] **Root Cause:** Current requirement statuses do not clearly separate legally blocking omissions from advisory evidence gaps.
- [x] **Corrective Actions:**
  - [x] Add rule classification (`blocking`, `advisory`) per requirement.
  - [x] Update submit gate to block only on `blocking`.
  - [x] Show advisory items as warnings, not hard failures.
- [x] **Success Criteria:**
  - [x] Submit gate blocks only on explicit blocking requirements.
  - [x] UI distinguishes warning vs blocking states.

## 4) HMRC Mapping Alignment for DE 2/3 and Origin Evidence
- [x] **Severity:** High
- [x] **Estimated Effort:** Medium-Large (1-2 days)
- [x] **Root Cause:** Rule templates and generated docs are useful, but not yet fully mapped by scenario to HMRC DE references and agreement-specific origin evidence.
- [x] **Corrective Actions:**
  - [x] Map requirement codes by declaration scenario and HMRC DE references.
  - [x] Add agreement-aware origin proof handling (`EUR.1`, statement on origin, importer’s knowledge, Form A).
  - [x] Validate generated templates against required DE evidence payloads.
- [x] **Success Criteria:**
  - [x] Each scenario has documented HMRC-aligned requirement set.
  - [x] Generated docs correspond to accepted evidence classes.

## 5) Reports/Records Truthfulness Guardrails
- [x] **Severity:** Medium
- [x] **Estimated Effort:** Medium (1 day)
- [x] **Root Cause:** Reports and financial records currently include synthesized/placeholder values that may be interpreted as finalized customs truth.
- [x] **Corrective Actions:**
  - [x] Label computed/demo values clearly in UI.
  - [x] Add provenance metadata per figure (`derived`, `hmrc_confirmed`).
  - [x] Disable misleading exports where data is not authoritative.
- [x] **Success Criteria:**
  - [x] Users can distinguish estimated vs HMRC-confirmed values.
  - [x] No exports claim finality for placeholder records.

## 6) End-to-End Regression Suite for Customs Flow
- [x] **Severity:** Medium
- [x] **Estimated Effort:** Medium (1 day)
- [x] **Root Cause:** Rapid feature changes across docs, submit, reports, and records risk silent breakage without flow-level tests.
- [x] **Corrective Actions:**
  - [x] Add E2E checklist and smoke tests for upload/paste/replace/delete/generate/submit.
  - [x] Validate auth ownership checks for doc actions.
  - [x] Validate requirement state transitions (`missing -> uploaded -> missing`).
- [x] **Success Criteria:**
  - [x] Test run passes before release.
  - [x] Core customs flow is reproducible and stable.
