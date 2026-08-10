# Part 3a — Schema and submit-route integration

Status: **built and tested.** Submit works end to end on both routes. Amend and
cancel are Part 3b and still take the direct path unconditionally.

---

## Schema ([convex/schema.ts](../../../convex/schema.ts))

Extended, not duplicated, per spec §10.1:

- **`declarations`** — `submissionTransport` (immutable after first attempt),
  `cnsEnvironment`, `cnsBadgeId`, `cnsTopic`, `cnsUcn`, `cnsGoodsLocationCode`,
  `cnsInventoryReferenceType`, `cnsCspId`, `cnsTransportState`,
  `cnsInventoryState`, `cnsLastNotificationAt`. New indexes `by_cnsCspId` and
  `by_org_transport_status`.
- **`submissions`** — `transport`, `cspId`, `attemptKey`, `requestHash`,
  `endpoint`, `outcomeCertainty`, `cnsErrorCode`, `cnsErrorMessage`. New indexes
  `by_cspId` and `by_lrn`. These two make it the correlation backbone for
  inventory rejections, which carry neither ConversationID nor MRN.
- **`org_hmrc_settings`** — `cnsClearanceEnabled`.
- **`clients`** — `cnsBadgeHolder`, enforcing the CNS rule that a separately
  badged client cannot have entries filed under badge RKA.
- **`cns_notifications`** (new) — raw envelopes: topic, notification id,
  partition, headers, Base64 body, decoded body, hash, persisted/acked/processed
  timestamps, parser error. Unique on topic + notification id.
- **`cns_poll_state`** (new) — lease owner and expiry, poll timings, failure
  count, next-poll floor, mode.

`status` is untouched. The machine vocabulary lives in `cnsTransportState`
alongside it, so no dashboard, portal or read-model surface changes.

## [convex/cns.ts](../../../convex/cns.ts)

- `getRoutingContext` — org entitlement and client badge status, which the API
  route cannot read for itself. Returns conservative defaults so unknown org or
  client causes a refusal, not a silent CNS submission.
- `assertAndStampTransport` — mirrors `assertAndStampEnvironment`. Throws
  `TRANSPORT_MISMATCH` on any attempt to change route after the first send.
- `setInventoryReference` — throws `UCN_LOCKED` if the UCN is changed after
  submission; the reference is baked into XML the CSP already holds.
- `recordTransportOutcome` — transport state and X-CSP-ID.

## [submit/route.ts](../../../src/app/api/hmrc/submit/route.ts)

Routing is decided **before** mapping, since the CNS route injects the inventory
reference into the XML. Everything upstream is shared unchanged: auth, ownership,
fraud headers, baseline validation, rule engine, code lists, XML preflight, the
`beginSubmission` claim, and submission evidence.

Three behaviours specific to this route:

**No HMRC token is resolved on the CNS path.** CNS authenticates with Basic
credentials; requiring an OAuth token would block submission on an unrelated
consent flow.

**A 202 is receipt, not acceptance.** The response reports `Processing` with
`cns_received_pending_processing` and the X-CSP-ID. It never sets an MRN and
never claims acceptance. The HMRC branch's "missing X-Conversation-ID is fatal"
gate is deliberately not applied — CNS never sends that header on a 202.

**An unknown outcome does not revert the claim.** On a 5xx or timeout CNS may
still have forwarded the declaration, so releasing the claim would let a retry
create a second live declaration under a fresh LRN. The route returns 504 and
tells the operator not to resubmit until notifications have been checked.

## Verification

`npm run test:cns` 88 pass · `npm run test:h1` 125 pass · typecheck clean · lint clean.
No live CNS call — still blocked on the password.

---

# Part 3b — Amend and cancel

Status: **built and tested.**

## The LRN fix

Both routes minted fresh references — `AM-{id}-{uniq}` and `CX-{id}`. Both source
specs say the FunctionalReferenceID must not change for an amendment or
cancellation, and on CNS it is load-bearing: an inventory pre-check rejection
carries no ConversationID and a blank MRN, so a changed LRN makes the
notification uncorrelatable.

[convex/cns.ts](../../../convex/cns.ts) `getCreateLrn` reads the original from
the append-only submission evidence — what was actually sent, not the mutable
declaration row. It prefers the accepted create attempt, since a rejected create
may legitimately be re-sent under the same LRN.

[src/lib/cns/follow-up.ts](../../../src/lib/cns/follow-up.ts) `resolveFollowUpLrn`
applies it: **CNS uses the create LRN; the direct HMRC path keeps its minted
reference unchanged.** Changing direct-path behaviour is a separate decision with
TDR evidence implications and is deliberately not bundled in here.

If the create LRN cannot be found, a CNS amend or cancel is **refused** with 409
`CNS_LRN_UNAVAILABLE` rather than sent under a fabricated reference that could
never be correlated.

## Route changes

[amend](../../../src/app/api/hmrc/amend/route.ts) and
[cancel](../../../src/app/api/hmrc/cancel/route.ts) both now resolve the stored
transport first, skip HMRC token resolution on the CNS path, and branch before
the outbound call. All existing gates — status checks, EORI format, environment
stamp, evidence recording — are shared and unchanged.

Unknown outcomes return 504 and tell the operator to check notifications before
retrying, rather than reporting a rejection CNS never gave.

## Nil/blank amendment

`assertNilAmendmentRequest` enforces ChangeReasonCode 31 with the original LRN,
MRN, UCN, requesting operator and reason. Per spec §7.5 it is **not** wired to
fire automatically on CDS20001 — it needs operator confirmation that the Compass
record is actually corrected, and an audit trail. The operator-facing action is
Part 5.

## Verification

`npm run test:cns` 100 pass · `npm run test:h1` 125 pass · typecheck clean · lint clean.
