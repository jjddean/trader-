# Development Baseline Summary

## Overview
- Date: current local working session baseline
- Scope: customs declaration flow, unified documents workflow, submit gate integrity, reports/records side-sheet action wiring.
- Objective: align code, docs, and plan status before next phase.

## Completed Work
- Unified read-model architecture for dashboard/declaration surfaces (`dashboard_summary`, `declaration_preview`).
- Reduced heavy Convex fan-out queries and shifted to write-maintained read models.
- Added indexes for hot paths (`conversationId`, `declaration`, document by declaration).
- Unified document taxonomy in shared utility catalog.
- Implemented document action wiring:
  - download
  - remove
  - replace
  - manual paste ingestion
- Fixed upload linkage:
  - declaration linkage is persisted via `declarationId`
  - MRN kept as metadata
- Added persisted declaration requirement layer (`document_requirements`).
- Added requirement hydration + template generation flow in unified documents page.
- Retired legacy declaration-scoped documents page by redirecting to unified flow.
- Wired dead side-sheet actions on:
  - customs reports
  - financial records
- Added reports/records provenance guardrails:
  - explicit derived-data labels
  - non-authoritative export/download disabled states
- Implemented Phase 3 rules:
  - requirement classification (`blocking` vs `advisory`)
  - submit gate blocks only on missing blocking requirements
  - advisory gaps shown as warnings

## Pending Items (from Fix Plan)
- None. Fix-plan items 1-6 are complete.

## Blockers / Risks
- HMRC alignment remains partially product-defined; legal/compliance interpretation must be finalized for scenario-specific document rules.
- Reports and records still include derived placeholder values that can be mistaken for authoritative HMRC outcomes.
- Existing data may contain requirements without `requirementLevel`; runtime defaults treat unknown as `blocking`.

## Synchronization Status
- Codebase: aligned to implemented features and gating behavior.
- Plan tracking: `docs/app-flow-fix-plan.md` updated; Items 1-3 marked complete.
- Documentation: this baseline summary added and aligned with current implementation.
- Repository status: local workspace includes all implemented changes; no rollback needed.

## Milestone Progress
- Milestone A (Flow unification): complete.
- Milestone B (Document operations + persistence): complete.
- Milestone C (Submit gate correctness): complete with blocking/advisory separation.
- Milestone D (Regulatory alignment hardening): complete for DE 2/3 scenario mapping and agreement-aware evidence recommendations.
- Milestone E (Regression automation): complete.

## Validation Snapshot
- Convex function/schema updates compiled and codegen refreshed during implementation.
- Typecheck run (`npx tsc --noEmit`) passes after current phase edits.
- File diagnostics on edited files are clean at handoff.
