# Duty & Classification Audit — Saveable Checklist

Purpose: capture gaps and concrete remediation steps to ensure every declaration and product is reviewed for correct duty/classification before submission.

How to use: edit this file and check boxes as you complete items. Link PRs/issues to each checked item for audit trace.

- [ ] **Webhook deduplication:** Prevent duplicate `notifications` rows from repeated HMRC deliveries.
  - Why: `saveWebhook` currently always inserts; duplicate deliveries produce duplicate rows and can confuse timeline/replay.
  - Acceptance criteria: webhook insert is idempotent by `notificationId` or `(conversationId + hash(rawPayload))`; duplicates are ignored and a single row kept.
  - Next: implement and test idempotent insert or pre-check uniqueness in Convex mutation.

- [ ] **Webhook reliability & fallback:** Verify push + pull coverage and backoff.
  - Why: push can be missed; scheduled pulls exist but need test coverage and alerting for persistent misses.
  - Acceptance criteria: delayed pulls (`schedulePostSubmitNotificationPulls`) are exercised in integration tests and pull failures logged to audit with counts.
  - Next: add E2E tests that simulate missed push and validate pull saves notifications.

- [ ] **Notification linking rules:** Harden `collectDeclarationNotifications` dedupe/merge logic.
  - Why: conversationId vs MRN precedence and MRN-only notifications need robust merging to avoid replaying old MRN rows.
  - Acceptance criteria: timeline shows single authoritative timeline per submit cycle; older MRN-only rows are not replayed for newer conversation cycles.
  - Next: add unit tests with scenarios: submit → amend → cancel (different conversationIds + MRNs).

- [ ] **CDS auth token monitoring & refresh:** Alert on refresh failures and expiring refresh tokens.
  - Why: `resolveHmrcAccessToken` auto-refreshes, but expired refresh tokens require user reconnect; failures should surface to ops and user.
  - Acceptance criteria: when refresh fails, create `auditLogs` + user-visible banner + admin alert (email/Slack). Token expiry buffer configurable via `HMRC_TOKEN_EXPIRY_BUFFER_MS`.
  - Next: add convex mutation on refresh failure that flags workspace `hmrcTokens` row and trigger admin alerting webhook.

- [ ] **Submission preflight coverage:** Ensure rule engine blocks costly errors (commodity, CPC, origin, valuation, invoice mismatch).
  - Why: `evaluateRules` + `declaration_completeness` already gate submissions; confirm rule set coverage for top loss drivers.
  - Acceptance criteria: identified high-cost error classes have blocking rules and appear in dry-run actionableFailures; coverage report exists listing missing rules for high-frequency HMRC rejections.
  - Next: produce a one-off coverage report comparing top HMRC rejection codes to `rule_definitions` and add missing rules as `CURATED-` with evidence.

- [ ] **Historical duty estimation & drift detection:** Use `historical_declarations` to spot classification drift or unexpected duty changes.
  - Why: unexpected duty/VAT changes may indicate misclassification or tariff changes.
  - Acceptance criteria: nightly job computes per-prefix historical rates, flags items with duty/VAT deviating > X% from history for review; dashboard shows drift alerts.
  - Next: add cron job (Convex cron) or scheduled task to compute and emit alerts for prefix-level drift.

- [ ] **HS code & tariff validation pipeline:** Ensure `tariff_cache` and `cds_code_lists` are seeded and rule-driven.
  - Why: code-list validation prevents obvious invalid commodity codes reaching HMRC.
  - Acceptance criteria: dry-run rejects invalid HS codes and admin job refreshes `tariff_cache` regularly; missing seed runs flagged in admin UI.
  - Next: add seed/run scripts and a health check endpoint verifying `cds_code_lists` population.

- [ ] **ML/assisted classification (optional):** Add an assist mode to suggest HS/commodity codes with confidence scores.
  - Why: manual classification errors are common — ML assists reduce human error and speed review.
  - Acceptance criteria: model suggestions appear as non-blocking advisories; human must accept before submission.
  - Next: prototype on sample historical rows as separate feature (not blocking until validated).

- [ ] **Automated stuck/failed declaration monitoring:** Add cron/alert rule for declarations stuck in `Processing` > threshold or lacking HMRC-confirmed notifications.
  - Why: no current cron monitors long-running `Processing` states; ops rely on manual runbook steps.
  - Acceptance criteria: cron finds declarations with status `Processing` older than N minutes/hours and no confirmed HMRC notification → create alert (audit row + email/Slack) and optionally enqueue pull for conversationId.
  - Next: add Convex cron job `scan-stuck-declarations` with configurable threshold and alert webhook.

- [ ] **Ops runbook automation hooks:** Wire runbook actions to executable scripts/links for first-line support.
  - Why: runbook currently manual; automating common actions reduces MTTR.
  - Acceptance criteria: runbook links trigger (1) pull notifications for a conversationId, (2) status-query for MRN, (3) token refresh diagnostics.
  - Next: add admin UI buttons that call existing API endpoints and attach audit logs when used.

- [ ] **Audit & evidence retention policy:** Define retention for `notifications.rawPayload`, `auditLogs`, `historical_declarations` and backup policy.
  - Why: storage & compliance governance; large raw payload retention needs policy.
  - Acceptance criteria: retention policy documented and implemented (archival to S3 or prune older than X years), with ability to snapshot accepted payloads (`spec/passing-payload.xml`).
  - Next: document retention values and implement archiver task.

- [ ] **Test coverage & CI gate:** Add tests for rule engine, webhook idempotency, and stuck-declaration cron.
  - Why: prevent regressions — critical for preventing costly HMRC submissions.
  - Acceptance criteria: CI runs unit tests for `rule_engine`, integration for submit→pull flow, and cron smoke test.
  - Next: add tests under `tests/` and ensure `npx playwright test` / node scripts cover these scenarios.

---

Quick metadata

- Owner: ops@freightcode (update as needed)
- Priority: P0 for webhook dedup / stuck-declaration alerting; P1 for token alerting and tariff coverage; P2 for ML assist.
- How to mark done: check box and create PR referencing this checklist line.

If you want, I can (pick one):
- implement a Convex cron `scan-stuck-declarations` and PR it, or
- add idempotency to `saveWebhook` to dedupe notifications.

