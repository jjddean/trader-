# GB Dual-Use Training Dataset Plan

**Status:** ACTIVE — 24 of 104 items ticked.

Last updated: 11 July 2026

## Objective

Produce evidence-backed candidate records from the UK Dual-Use List for consultant review and, only after review and correction, convert approved records into training data.

This plan is separate from the older HS-code/Trade Tariff dataset.

## Fixed scope for seed batch 001

- Jurisdiction: `GB`
- Legal scope: `UK_DUAL_USE_ANNEX_I`
- Control-list version: `2025-12-16`
- Batch ID: `gb-dualuse-seed-001`
- Families: `3A001`, `4A003`, `5A001`, `5A002`, `6A003`
- Records: 5 per family, 25 total

Each family must contain:

- [ ] One product that appears to meet the selected requirement
- [ ] One product that clearly fails a decisive threshold
- [ ] One product potentially covered by an exclusion or decontrol note
- [ ] One product with insufficient public evidence
- [ ] One hard negative that resembles the controlled item but fails a decisive requirement

## Non-negotiable evidence rules

- [x] The official 16 December 2025 UK control-list PDF is stored locally.
- [x] The parsed snapshot is linked to the PDF by matching SHA-256.
- [ ] Every record identifies an exact control subparagraph.
- [ ] Every legal threshold and condition is extracted from the versioned source, not manually invented.
- [ ] Every exact product model is confirmed by a primary manufacturer source.
- [ ] Every established decisive product fact has a quotation, URL and document location.
- [ ] Missing facts remain `null`; they are not inferred.
- [ ] Specifications from different variants are never combined.
- [ ] Numeric and Boolean comparisons are performed in code.
- [ ] Applicable notes, definitions, exclusions and cross-references are checked.
- [ ] Consultant final fields remain `null` during candidate generation.
- [ ] Unsupported records are rejected or explicitly retained as insufficient-evidence examples.
- [ ] No record enters training data before consultant review and correction.

## Phase 0 — Source readiness

- [x] Store official control-list PDF.
- [x] Calculate official PDF SHA-256.
- [x] Parse the official list into a local snapshot.
- [x] Verify the snapshot records the same source hash.
- [x] Confirm `6A003` text is present.
- [x] Run existing parser and retrieval smoke tests.
- [ ] Add exact hierarchical subparagraph extraction for all five seed families.
- [ ] Add regression tests for every selected subparagraph, note and exclusion.

Status: **partially complete**. The official source is ready, but the broad parser does not yet preserve all nested legal structure.

## Phase 1 — Three-record `6A003.a.4` pilot

### Engineering foundation

- [x] Extract `6A003.a.4` from the official snapshot.
- [x] Parse the strict `> 1,000,000 frames/s` threshold from source text.
- [x] Capture the modular-camera note from source text.
- [x] Define the candidate-record data types.
- [x] Define manufacturer source-document provenance.
- [x] Define extracted-specification evidence fields.
- [x] Implement deterministic comparison results.
- [x] Treat equality as `EQUAL_TO_BOUNDARY` for a strict `>` condition.
- [x] Add an initial record acceptance validator.
- [x] Add focused tests.
- [x] Pass 10 focused export-control tests.
- [x] Pass focused lint with zero warnings.
- [ ] Refine acceptance rules for legitimate `INSUFFICIENT_EVIDENCE` records.

### Pilot candidates

- [x] SIMX identified from Specialised Imaging primary material.
- [x] Cordin Model 560 identified from Cordin primary material.
- [x] SIR3 identified from Specialised Imaging primary material.
- [x] Cordin Model 560 manufacturer PDF archived locally and hashed.
- [ ] Archive or snapshot the decisive SIMX manufacturer source.
- [ ] Archive or snapshot the SIR3 manufacturer source.
- [ ] Verify exact document revision/date for SIMX.
- [ ] Verify exact document revision/date for SIR3.
- [ ] Build SIMX candidate record: `APPEARS_TO_MEET`.
- [ ] Build Cordin Model 560 candidate record: `HARD_NEGATIVE` because it is a rotating-mirror camera.
- [ ] Build SIR3 candidate record: `INSUFFICIENT_PUBLIC_EVIDENCE` if maximum framing rate remains unestablished.
- [ ] Run deterministic comparisons for all three records.
- [ ] Validate all three records.
- [ ] Produce the pilot JSONL and pilot batch report.
- [ ] Manually audit every quotation, URL, page and comparison.
- [ ] Obtain consultant review before treating any result as labelled truth.

Status: **foundation complete; records and audit remain**.

## Phase 2 — Seed batch of 25

Do not begin until the three-record pilot passes its evidence audit.

### `3A001` — five records

- [ ] Select exact subparagraphs from the official list.
- [ ] Parse conditions, thresholds, notes and exclusions.
- [ ] Define required evidence.
- [ ] Research five real products in the required composition.
- [ ] Validate and audit all five records.

### `4A003` — five records

- [ ] Select exact subparagraphs from the official list.
- [ ] Parse conditions, thresholds, notes and exclusions.
- [ ] Define required evidence.
- [ ] Research five real products in the required composition.
- [ ] Validate and audit all five records.

### `5A001` — five records

- [ ] Select exact subparagraphs from the official list.
- [ ] Parse conditions, thresholds, notes and exclusions.
- [ ] Define required evidence.
- [ ] Research five real products in the required composition.
- [ ] Validate and audit all five records.

### `5A002` — five records

- [ ] Replace the existing simplified hard-coded check with source-derived requirements.
- [ ] Preserve cryptography-note and exclusion logic.
- [ ] Define required evidence.
- [ ] Research five real products in the required composition.
- [ ] Validate and audit all five records.

### `6A003` — five records

- [ ] Expand the approved pilot to the required five-record composition.
- [ ] Validate and audit all five records.

### Batch completion

- [ ] Exactly 25 accepted JSONL candidate records.
- [ ] Rejection ledger records every rejected candidate and reason.
- [ ] Batch counts reconcile with the JSONL.
- [ ] No duplicate manufacturer/model/control-role combination.
- [ ] All consultant fields remain `null`.
- [ ] Final batch report generated mechanically.
- [ ] Consultant review package prepared.

## Phase 3 — Consultant-labelled dataset

- [ ] Consultant reviews every seed record.
- [ ] Record corrections without overwriting original AI suggestions.
- [ ] Separate accepted, corrected and rejected records.
- [ ] Measure disagreement by family and composition role.
- [ ] Update parsers, evidence rules and prompts from recurring corrections.
- [ ] Freeze dataset version `0.1-reviewed` only after sign-off.

## Phase 4 — Scale in controlled batches

- [ ] Produce the next 25-record batch only after seed feedback is incorporated.
- [ ] Continue in batches of 25 with balanced families and outcomes.
- [ ] Re-run citation, schema, duplicate and leakage checks for every batch.
- [ ] Review a minimum agreed sample—or all records—before acceptance.
- [ ] Target approximately 500 reviewed records for an initial useful dataset.
- [ ] Consider 1,000–2,000 reviewed records only after quality metrics are stable.

## Phase 5 — Training readiness

- [ ] Freeze authoritative source versions and hashes.
- [ ] Split by product family/model to prevent train/evaluation leakage.
- [ ] Preserve candidate reasoning separately from consultant truth.
- [ ] Convert only reviewed records into the chosen training-message format.
- [ ] Create held-out evaluation cases with hard negatives and exclusions.
- [ ] Establish baseline performance before training.
- [ ] Train only after dataset and evaluation approval.
- [ ] Do not describe the result as legal advice or automatic final classification.

## Current position

We are at **Phase 1: three-record `6A003.a.4` pilot**.

Completed:

- Official source acquisition and hash verification
- Source-derived `6A003.a.4` requirement
- Candidate schema and initial acceptance gates
- Deterministic threshold comparison
- Pilot product identification
- Focused tests and lint

Next:

1. Refine the insufficient-evidence validation rule.
2. Finish source archiving and metadata for SIMX and SIR3.
3. Assemble and validate the three pilot records.
4. Audit the pilot with the user.
5. Obtain consultant review.
6. Only then expand to the first 25-record seed batch.

## Stop conditions

Stop the batch and correct the pipeline if any of the following occurs:

- Official subparagraph cannot be reproduced from the source.
- A legal threshold was manually substituted for parsed source text.
- Exact product variant cannot be confirmed.
- A decisive fact lacks primary evidence.
- Source documents conflict and the conflict is not recorded.
- Notes or exclusions were skipped.
- JSON schema or batch counts fail.
- Consultant corrections reveal a repeated systematic error.

