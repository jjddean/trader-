Title: Fix notification timeline visibility (B2 & B3) — do not merge

Summary
-------
This branch fixes two bugs causing HMRC notification timelines to go blank after a re-submit:

- B2: `getWebhooks` / `collectDeclarationNotifications` post-filtering removed new MRN notifications when a declaration still contained a stale MRN. The collector now skips the MRN-only post-filter when `declarationId` or `conversationId` is provided (reads are still scoped by declaration/conversation). A targeted unit test was added to cover the re-submit case.

- B3: `updateDeclarationStatus` now accepts an optional `mrn` and applies it in the patch. The submit route already sends `mrn: ""` on re-submit to clear stale MRNs so HMRC-assigned MRNs from subsequent DMSACC notifications are not blocked by stale values.

Files changed
-------------
- `convex/lib/collect_declaration_notifications.ts` — skip MRN post-filter when `declarationId`/`conversationId` present; include MRN-only rows safely.
- `convex/declarations.ts` — accept optional `mrn` in `updateDeclarationStatus` (already present in this branch).
- `tests/h1/resubmit-notification-timeline.test.ts` — new test covering stale-MRN + new MRN scenario.

Testing
-------
- Ran `npm run test:h1` locally: all tests pass (43/43).
- Added unit test shows the new-MRN DMSACC is returned when `declarationId`/`conversationId` are provided even if the declaration stores a stale MRN.

Migration notes / operational impact
----------------------------------
- No Convex schema change required for this patch.
- Behaviour change: timeline reads are now tolerant of MRN-only HMRC notifications that arrive without `conversationId`. This prevents timeline gaps after re-submit.
- Long-term plan: write-time normalization (ensure every notification is resolved to a `declarationId` + `timelineScope`) and single `by_declaration` index. This patch is tactical and safe; we should follow up with the normalization migration.

Do not merge
------------
This PR is intentionally left as a draft per request — do not merge. After review, we can either merge this tactical fix and follow with the migration, or revert and implement full normalization in a single migration PR.

Reviewer checklist
------------------
- [ ] Confirm tests pass in CI
- [ ] Sanity-check `getWebhooks` surface via local Convex dev (`npx convex dev`) and a manual resubmit test in sandbox
- [ ] Approve or request changes

Notes
-----
Branch: `fix/notifications-timeline-bugs`
