# Production Hardening Plan

Status: **queued — not started**. Saved 2026-08-15 for later execution.

Mode: production-hardening. FreightCode is live; estimated 50–60% production-ready.
Objective: systematically harden the existing product until the core operational
platform is production-safe.

**Constraint:** do not add new major modules or redesign working areas unless
required to resolve a production issue.

---

## Immediate task

Start with `onboarding:completeManagedService`.

1. Reproduce the current production error:
   `CONVEX M(onboarding:completeManagedService) Server Error`
2. Find the actual root cause.
3. Fix it properly — no masking (no swallowed errors, no defensive `try/catch`
   that hides the failure).
4. Test the complete Managed Service onboarding flow end-to-end.
5. Inspect adjacent onboarding mutations/components for the same failure pattern.

Then continue through the sequence below rather than stopping after the first bug.

---

## 1. Identify and log current production failures

- Current known failure: `onboarding:completeManagedService` server error.
- Root-cause each failure; fix properly rather than masking.
- Check adjacent onboarding mutations/components for the same pattern.

## 2. Map the existing critical production workflows

Test the actual application paths end-to-end:

- Authentication / sign-up
- Organisation creation
- Broker onboarding
- Managed Service onboarding
- Client creation / editing
- Client portal invitation and access
- Declaration creation / editing
- HMRC connection / OAuth
- CDS validation / submission
- HMRC response handling
- Documents / uploads / linking
- Charges / payments records
- Messages
- Export-control cases

## 3. Classify every issue

| Severity | Definition |
|----------|------------|
| **P0** | Blocks operations, causes server errors, risks incorrect customs submissions, loses/corrupts data, security or tenant issue |
| **P1** | Workflow / recovery / reliability issue that materially affects production use |
| **P2** | UX / polish issue that does not prevent operation |

Fix P0 before P1. Do not polish P2 while P0/P1 remain.

## 4. Audit Convex production safety

Review mutations/queries/actions used by critical workflows for:

- authentication
- organisation / tenant isolation
- server-side permissions
- input validation
- incorrect cross-org IDs
- partial writes
- duplicate execution
- idempotency
- orphaned records
- client / declaration / document relationships
- archive / delete behaviour
- existing legacy production records

## 5. Harden the CDS lifecycle

Verify the complete flow:

`Draft → Validate → Submit → Accepted/Rejected → Tax → Clearance → Amend/Cancel → Archive`

Test failure conditions as well as success:

- HMRC timeout
- OAuth expiry / failure
- rejected declaration
- duplicate submission attempt
- retry after failure
- repeated HMRC/SDS event
- malformed / unexpected HMRC response
- DMSACC
- DMSTAX
- DMSCLE
- DMSREJ
- DMSINV
- amendment / cancellation failure

**A retry must never create an accidental duplicate customs submission.**

Reference: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` (compliance authority).

## 6. Add proper production observability

Use the existing stack where appropriate: Convex logs, BetterStack, PostHog,
Cloudflare, Resend.

Important production failures must expose enough internal information to identify:

`request/correlation ID → user → organisation → client/job/declaration → operation → error`

**Customers must not see raw internal/server errors.**

## 7. Test recovery states

For every important workflow, deliberately interrupt/fail it and verify recovery:

- upload succeeds but DB save fails
- onboarding partially completes
- invite is sent but later step fails
- HMRC request times out
- browser refresh during an operation
- double-click / double-submit
- expired authentication / session
- failed / retried background processing

## 8. Run complete acceptance journeys

**Broker**
`Sign up → Organisation → Onboarding → Connect HMRC → Client → Declaration → Documents → Validate → Submit → HMRC response → Complete`

**Managed Service customer**
`Sign up → Onboarding → Company details → Documents → Communication → Declaration/clearance status → Charges → Completion`

**International client portal**
`Invite → Sign up/login → Company → Declarations → Requested documents → Upload → Messages → Charges → Export controls → History`

Record every broken, confusing or incomplete state encountered.

## 9. Security review

Verify:

- Clerk authentication boundaries
- organisation isolation
- portal isolation
- role permissions
- Convex server-side access checks
- R2 document access
- secrets / environment separation
- rate limiting where required
- audit events
- TDR / live environment separation

**Manipulating a client-side ID must never expose another organisation's data.**

## 10. Data and operational resilience

Verify:

- production backups
- restore procedure
- safe schema migrations
- backward compatibility with existing records
- required / optional field behaviour
- indexes / production query performance
- archive / retention behaviour

## 11. Regression

After fixes, rerun the critical workflows so one fix has not broken another part
of the product.

## 12. Production readiness status

Maintain a simple status per core area:

- 🔴 **RED** — broken / unsafe
- 🟠 **AMBER** — functional but not sufficiently hardened
- 🟢 **GREEN** — production-ready

**Do not mark an area GREEN just because its happy path works.** It must also have
correct permissions, failure handling, recovery and production-safe data behaviour.

### Status board

| Area | Status | Notes |
|------|--------|-------|
| Authentication / sign-up | ⬜ not assessed | |
| Organisation creation | ⬜ not assessed | |
| Broker onboarding | ⬜ not assessed | |
| Managed Service onboarding | 🔴 RED | `onboarding:completeManagedService` server error |
| Client creation / editing | ⬜ not assessed | |
| Client portal invite / access | ⬜ not assessed | |
| Declaration creation / editing | ⬜ not assessed | |
| HMRC connection / OAuth | ⬜ not assessed | |
| CDS validation / submission | ⬜ not assessed | |
| HMRC response handling | ⬜ not assessed | |
| Documents / uploads / linking | ⬜ not assessed | |
| Charges / payments | ⬜ not assessed | |
| Messages | ⬜ not assessed | |
| Export-control cases | ⬜ not assessed | |
| Observability | ⬜ not assessed | |
| Security / tenant isolation | ⬜ not assessed | |
| Data resilience / migrations | ⬜ not assessed | |

---

## Required reporting format

Each report back must give:

- what was inspected
- issues found
- severity of each issue
- fixes made
- files changed
- tests performed
- anything still RED or AMBER
- the next item in the production-hardening sequence
