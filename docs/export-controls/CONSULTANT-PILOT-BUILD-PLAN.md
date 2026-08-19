# Consultant Pilot — Build Plan

**Status:** ACTIVE — proposed, not started. Concrete build plan for the Phase 1 pilot described in
`CONSULTANT-REVIEW-NETWORK-PLAN.md`, grounded in the code as it exists today.

That document describes the commercial and multi-phase shape of the service and
is still a draft. This one covers only what gets built for one consultant (BEC)
and one connected application, and states the defaults it assumes so they can be
overruled individually rather than re-litigated as a whole.

---

## Scope

**In:** consultant identity, case delivery to an authenticated inbox, and status
visibility for the sender.

**Out:** any new review form. The consultant reviews in the FreightCode screens
that already exist. BEC is an inbox and a launch point, never a second workflow.

---

## What exists today

### FreightCode — the review flow is built and working

| Piece | Location |
|---|---|
| Send form (`consultantEmail`, `senderNote`) | `src/components/trade-compliance/consultant-signoff-card.tsx` |
| Dispatch + token creation | `convex/compliance_consultant.ts` → `createConsultantDispatch` |
| Email delivery | `src/app/api/export-controls/send-to-consultant/route.ts` |
| Review page (`/r/export/{token}`) | `src/components/trade-compliance/consultant-review-page.tsx` |
| Submit (`advisoryNotes`, `outcome`, `applicationRef`, `licenceRef`) | `convex/compliance_consultant.ts` → `completeConsultantReview` |
| Tables | `convex/schema.ts` → `expert_requests`, `export_review_tokens` |

The review page already renders GOV.UK guidance, draft pack fields, product
evidence, sanctions results, EUSU, and the review submit form. **None of this
changes.**

### BEC — nothing to integrate with yet

`C:\Users\jason\Bec` is a static marketing site: Next 16.2.12, React 19,
Tailwind 4, dependencies `next` / `react` / `react-dom`. Eight pages, four
components, no `src/app/api/`, no auth, no datastore. The contact form posts
client-side to Formspree.

Everything in Part 1 below is net-new to BEC.

---

## The problem this solves

Delivery and identity, not review capability.

`getReviewByToken` and `completeConsultantReview` are both public and
token-only — neither calls `ctx.auth.getUserIdentity()`. Two consequences:

1. **Anyone holding the link is the consultant.** The token is a 32-byte
   bearer credential with a 14-day TTL, delivered by email.
2. **The audit trail records an unverified string.** `completeConsultantReview`
   writes `userId: row.consultantEmail` — whatever address the sender typed
   into the send form. For an export-control decision record, that is the weak
   point worth closing.

Everything else about the current flow is sound.

---

## Assumed defaults

Each is reversible on its own. Stated so the build can start without a
decision round.

| # | Decision | Default | Why |
|---|---|---|---|
| 1 | Consultant identity | Handoff binds a verified Supabase identity | Closes the audit-trail gap above |
| 2 | Status model | Keep `sent` / `completed` / `blocked` | One consultant; richer states are speculative until a case needs one |
| 3 | Transport | BEC polls FreightCode | No signing secret, no delivery-retry table, no replay defence to build |
| 4 | Login | Supabase magic link | One consultant; no password storage |
| 5 | Email | Stays on, unchanged | Fallback for the whole pilot |

Default 3 is the cheapest thing that works at pilot volume and is the piece most
likely to change first. Webhooks become worth it when polling latency or request
volume actually bites — not before.

---

## Part 1 — BEC gets an authenticated inbox

Prerequisite: a Supabase project, and `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Work

- Add `@supabase/supabase-js` and `@supabase/ssr`; browser and server clients;
  middleware session refresh.
- Magic-link login at `/login`; protected `/reviews` route group. No public page
  changes.
- `consultant_reviews` table: FreightCode review id (unique), reference, status,
  subject label, priority, due date, expiry, received time, handoff state.
- RLS: authenticated consultants read; service role writes. No anon access.
- Reviews list showing reference, status, due date, received time, and an
  **Open secure review** action.

### Exit criteria

- A consultant signs in by magic link and sees an empty, access-controlled queue.
- An unauthenticated request to `/reviews` cannot read a row.
- The marketing site is byte-identical to a visitor.

---

## Part 2 — FreightCode exposes the case list

### Work

- Partner credential for BEC, stored server-side only.
- `GET /api/partner/reviews` — cases assigned to the calling partner. Metadata
  only: id, reference, status, priority, due date, expiry. No evidence, no
  personal data beyond the agreed display label, no reusable link.
- Bind dispatches to a partner. `export_review_tokens` already carries
  `consultantEmail`; add a partner reference so a case can be addressed to BEC
  rather than to an address.
- Record every partner request in `auditLogs`.

### Exit criteria

- BEC's server lists its own cases and only its own.
- A missing or wrong credential returns 401 and is logged.
- The response body cannot be replayed as a review link.

---

## Part 3 — One-time handoff and identity binding

The core of the pilot.

### Work

- `POST /api/partner/reviews/{id}/handoff` — partner-authenticated, returns a
  single-use, short-lived URL. Verifies partner, assignment, status and expiry.
- BEC's **Open secure review** calls this server-side and redirects. No reusable
  URL is ever stored in BEC's database or rendered into markup.
- FreightCode consumes the code once and binds the review to the verified
  consultant identity.
- `completeConsultantReview` records the bound identity instead of
  `row.consultantEmail`.
- Fail closed on reuse, expiry, wrong partner, or unapproved user.

### Exit criteria

- A completed review's audit entry names a verified identity, not a typed string.
- A consumed handoff cannot be reused.
- A handoff issued for one consultant cannot be accepted by another account.
- Evidence is unreachable until handoff succeeds.
- The existing email token link still works.

---

## Part 4 — Status back to BEC

### Work

- BEC polls case status on the reviews list and after returning from a handoff.
- Local rows update idempotently.
- Sender-side status in FreightCode is unchanged — `getConsultantDispatchStatus`
  already serves it.

### Exit criteria

- A completed review shows as completed in BEC without a manual refresh cycle.
- Polling a revoked or expired case degrades cleanly.

---

## Pilot acceptance

- A FreightCode assessment reaches BEC's authenticated inbox with no email
  attachment.
- The consultant reviews and completes entirely in the existing FreightCode
  screens.
- Application and licence references land back on the assessment.
- The audit trail names a verified consultant.
- Revocation and expiry work end to end.
- Email fallback still works throughout.

---

## Explicitly not in this plan

- Webhooks, signing secrets, delivery-retry history (default 3).
- Extra review statuses (default 2).
- Any consultant-facing review form in BEC.
- Multiple consultants, routing, conflict checks.
- The provider API in `CONSULTANT-REVIEW-NETWORK-PLAN.md` Phase 2+.

---

## Dependency worth knowing

`DUAL-USE-DATASET-PLAN.md` reaches its 25-record seed batch only after
consultant review of the three-record pilot. That review does **not** need this
integration — email handles three records. It matters when batches scale.
