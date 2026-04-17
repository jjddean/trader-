# Operational Readiness and Rollback Runbook

## Scope
- Release safety controls for the customs/documents workflow.
- Covers checkpoint criteria, rollback triggers, monitoring focus, and incident handoff.

## Release Checkpoint (Go/No-Go)
- [ ] **Go if all true:**
  - `npm run test:e2e` passed.
  - `npx tsc --noEmit` passed.
  - Manual UAT matrix marked complete in `docs/e2e-customs-flow-regression.md`.
  - No P0/P1 open defects in submit/docs path.
- [ ] **No-Go if any true:**
  - Submit gate mismatch between Documents and Submit pages.
  - Document operations fail (`replace/remove/download`) in authenticated session.
  - Requirement state transition breaks (`missing -> uploaded -> missing`).

## Rollback Trigger Criteria
- Immediate rollback if any of the following occur post-release:
  - Submit failure rate materially spikes (for example >20% of attempts over 15 minutes) with same error signature.
  - Doc-action endpoint errors persist (`/api/ai/smart-upload`, download/delete/replace paths).
  - Auth mismatch/permission errors occur for valid owner operations at abnormal volume.
  - Critical data inconsistency appears (requirement state diverges across pages).

## Rollback Steps
1. Freeze new deployments.
2. Re-deploy previous known-good release artifact.
3. Verify health checks and smoke routes:
   - `/dashboard/documents`
   - `/dashboard/declarations/[id]/submit`
   - `/dashboard/reports`
   - `/dashboard/records`
4. Re-run `npm run test:e2e` on rollback build.
5. Announce status in incident channel with ETA for follow-up fix.

## Monitoring Focus Points
- Submit path:
  - submit failures by error type
  - blocked-vs-allowed gate outcomes
- Document path:
  - upload/paste failures
  - replace/remove/download failure counts
  - mapping drift (`Other/ZZZ` spikes)
- Auth path:
  - ownership mismatch responses
  - unexpected `401/403` ratio for normal user actions

## Incident Handoff
- **Primary owner:** Engineering (customs workflow)
- **Secondary owner:** Product/Operations lead
- **Required handoff details:**
  - issue start time
  - impacted user flow
  - error sample/signature
  - mitigation/rollback decision
  - next update timestamp

## Post-Incident Follow-Up
- Record root cause.
- Add or adjust regression test coverage.
- Update `docs/release-signoff-report.md` and backlog tasks.
