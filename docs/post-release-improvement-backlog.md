# Post-Release Improvement Backlog

## Sprint Goal
- Move from release-readiness validation to production hardening and operator visibility.

## Ticket 1: HMRC-Confirmed Data Feed for Reports/Records
- Priority: P1
- Owner: Engineering (Data Integrations) - Assigned
- Status: Completed (Phase 1 implementation)
- Problem:
  - Reports and financial records still rely on derived declaration preview data.
- Scope:
  - Ingest HMRC-confirmed declaration outcome and duty/VAT settlement data.
  - Persist provenance per metric as `hmrc_confirmed` vs `derived`.
  - Update Reports/Records UI and exports to use authoritative values when available.
- Acceptance Criteria:
  - Records with confirmed HMRC values render with authoritative provenance.
  - Export/download is enabled only for authoritative values.
  - Derived fallback remains explicit when confirmed values are absent.
  - No regressions in existing reports/records page load and filtering.
- Delivery Notes:
  - Reports page now uses `api.declarations.getReports` with provenance fields.
  - Records page now uses `api.declarations.getFinancialRecords` with `hmrc_confirmed` fallback when notification payloads expose values.
  - UI provenance badges now switch between `derived` and `hmrc_confirmed`.

## Ticket 2: Submit/Requirement Anomaly Telemetry Dashboard
- Priority: P1
- Owner: Engineering (Platform Observability) - Assigned
- Status: Completed (Phase 1 implementation)
- Problem:
  - No consolidated view for gate inconsistencies and requirement transition anomalies.
- Scope:
  - Add counters/events for:
    - blocking/advisory gate decisions
    - requirement transitions (`missing -> uploaded -> missing`)
    - docs-submit mismatch incidents
  - Add dashboard views and alert thresholds.
- Acceptance Criteria:
  - Dashboard shows daily counts and trendline for core anomaly classes.
  - Alert fires when mismatch threshold is crossed.
  - At least one runbook link exists from alert to triage steps.
- Delivery Notes:
  - Added Convex telemetry query: `api.documents.getRequirementTelemetry`.
  - Added dashboard UI route: `/dashboard/tools/telemetry`.
  - Includes active alerts, 7-day trend, threshold handling, and runbook reference.

## Ticket 3: Doc-Action/Auth Error Observability
- Priority: P2
- Owner: Engineering (Workflow Services) - Assigned
- Status: Completed
- Problem:
  - Endpoint errors for upload/replace/remove/download and auth mismatches are not centrally tracked.
- Scope:
  - Standardize structured error logging for:
    - `/api/ai/smart-upload`
    - document download/delete/replace paths
    - ownership mismatch and auth failures
  - Add error-rate panel with top signatures.
- Acceptance Criteria:
  - Structured logs include declarationId/userId/doc code context where safe.
  - Error-rate panel identifies top 5 error signatures.
  - Rollback trigger signals in `docs/operational-readiness-runbook.md` can be measured directly.
- Delivery Notes:
  - Added structured error logging for smart upload route failures (`smart_upload_error`).
  - Added structured error logging for document mutation failures (`doc_action_error`).
  - Telemetry dashboard now includes 7-day doc-action error-rate panel and top signatures.

## Delivery Notes
- Planning status: Ready for sprint intake.
- Dependencies:
  - Access to HMRC-confirmed response payload fields in integration layer.
  - Alerting destination/channel configured for observability signals.
