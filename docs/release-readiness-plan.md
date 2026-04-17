# Release Readiness Plan Checklist

## Release Goal (Current Stage)
- Validate internal consistency of the shipment flow:
  - input -> document mapping -> requirements engine -> submit payload build
- Current validation target is internal consistency, not HMRC acceptance.
- Stage objective is **not** full HMRC acceptance certification yet.

## Stage-Gate Validation Criteria
- Primary question for this stage:
  - "Can a shipment go from input to valid submission payload without breaking?"
- Current-stage PASS if all are true:
  - no manual DB fixes required
  - no page mismatch between Documents and Submit
  - submit gate logic is consistent (blocking vs advisory)
  - payload is structurally valid
- Current-stage FAIL if any are true:
  - requirements differ between pages
  - submit blocks unpredictably
  - uploaded docs are not recognized/mapped
  - payload misses expected structural fields

## Explicitly Out of Scope (This Stage)
- Do not block this release-readiness stage on:
  - full CDS field coverage
  - full DE mapping depth for all scenarios
  - full WCO config completeness
  - real HMRC acceptance outcomes
- Those are next-phase hardening targets.

## Failure-Path Mini-Test (Required)
- Test: remove invoice after requirement satisfaction.
- Expected:
  - submit becomes blocked again on missing blocking requirement
  - user sees clear blocking message
- Interpretation:
  - If this fails, internal consistency is not reliable and release should pause.

## Minimum Viable CDS-Ready Declaration Checklist (This Stage)
- Reference notes:
  - CDS guidance: `https://www.gov.uk/guidance/customs-declaration-service`
  - Data elements reference (review needed if unavailable): `https://www.gov.uk/guidance/data-element-structures-for-the-customs-declaration-service`
  - EORI guidance: `https://www.gov.uk/eori`
- Parties:
  - Exporter/Consignor identity present
  - Importer/Consignee identity present
  - EORI captured where legally required for the declaration scenario
- Goods line integrity:
  - at least one goods item
  - commodity code present
  - customs value present
  - movement context present (route/country/transport where used)
- Supporting evidence:
  - required documents mapped into `document_requirements`
  - blocking vs advisory classification applied
  - requirement statuses consistent across Documents and Submit views
- Submission readiness:
  - pre-flight checks pass as expected
  - payload preview builds structurally
  - dry run gate and submit gate are coherent

## 1) Automated Regression Gate
- [x] **Severity:** Critical
- [x] **Estimated Effort:** Small (0.5 day)
- [x] **Objective:** Verify automated smoke coverage passes in release-candidate conditions.
- [x] **Execution Steps:**
  - [x] Run `npm run test:e2e:list` and confirm smoke suite discovery.
  - [x] Run `npm run test:e2e` against active local app base URL.
  - [x] Capture pass/fail artifacts and summarize outcomes.
- [x] **Success Criteria:**
  - [x] `test:e2e:list` discovers smoke tests.
  - [x] `test:e2e` passes without critical failures.
  - [x] Failures (if any) are documented with triage owner.

## 2) Manual UAT Matrix Completion
- [x] **Severity:** High
- [x] **Estimated Effort:** Medium (1 day)
- [x] **Objective:** Validate real user workflows across core customs scenarios.
- [x] **Execution Steps:**
  - [x] Execute matrix in `docs/e2e-customs-flow-regression.md`.
  - [x] Cover standard/export/controlled declaration contexts.
  - [x] Validate submit gating, advisory behavior, and requirement transitions.
- [x] **Success Criteria:**
  - [x] Matrix fully completed and signed off.
  - [x] No unresolved blockers in critical path (upload -> requirements -> submit).

## 3) Operational Readiness and Rollback
- [x] **Severity:** High
- [x] **Estimated Effort:** Medium (0.5-1 day)
- [x] **Objective:** Ensure production deploy has observability and safe rollback.
- [x] **Execution Steps:**
  - [x] Define release checkpoint and rollback trigger criteria.
  - [x] Confirm monitoring points (submit failures, doc-action errors, auth mismatches).
  - [x] Prepare incident owner/on-call handoff note.
- [x] **Success Criteria:**
  - [x] Rollback plan documented and approved.
  - [x] Monitoring and alert thresholds defined.
- [x] **Artifact:** `docs/operational-readiness-runbook.md`

## 4) Compliance Messaging and UX Signoff
- [x] **Severity:** Medium
- [x] **Estimated Effort:** Small (0.5 day)
- [x] **Objective:** Confirm provenance and advisory messaging is acceptable for users/legal.
- [x] **Execution Steps:**
  - [x] Review derived-data labels and disabled export states.
  - [x] Confirm wording in reports/records and submit warnings.
  - [x] Adjust copy for clarity where needed.
- [x] **Success Criteria:**
  - [x] Messaging accepted by product/compliance stakeholders.
  - [x] No ambiguous “HMRC-confirmed” claims on derived data.
- [x] **Artifact:** `docs/compliance-messaging-signoff.md`

## 5) Improvement Backlog Kickoff (Post-Release)
- [x] **Severity:** Medium
- [x] **Estimated Effort:** Small (0.5 day planning)
- [x] **Objective:** Move from fix phase into controlled product improvement phase.
- [x] **Execution Steps:**
  - [x] Prioritize HMRC-confirmed data feed integration for reports/records.
  - [x] Define telemetry dashboard for requirement/gate anomalies.
  - [x] Create sprint-ready tickets with acceptance criteria.
- [x] **Success Criteria:**
  - [x] Prioritized backlog agreed for next sprint.
  - [x] Owners assigned for first improvement tranche.
- [x] **Artifact:** `docs/post-release-improvement-backlog.md`
