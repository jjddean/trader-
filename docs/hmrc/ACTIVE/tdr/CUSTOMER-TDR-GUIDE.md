
# Customer TDR Guide

**Audience:** Importers, brokers, and Freightcode operators  
**Status:** Product design + customer copy (HMRC does not publish SaaS multi-tenant guidance)  
**Compliance behaviour:** [`AGENT-SPEC.md`](./AGENT-SPEC.md) — this document does not override it

---

## Purpose

Freightcode is a UK customs declarations service. Before any declaration has legal effect at the border, customers need a **safe place to practise** — real HMRC APIs, real validation, no production risk.

HMRC’s public docs explain **API integration** and the vendor **Path to Production**. They do **not** explain how a multi-tenant SaaS should onboard thousands of traders into sandbox practice and later promote them to live CDS. This guide fills that gap: **customer-facing language** plus **what we build in the product**.

---

## Three names customers hear

| Term | Who it’s for | Host | Legal effect |
|------|----------------|------|--------------|
| **Trade Test** | **Freightcode (the vendor)** — software assurance with HMRC | `test-api.service.hmrc.gov.uk` | None. Uses Trade Test Data Library EORIs. **Not for customer use.** |
| **TDR** (Test Data Repository) | **Your organisation** — practice declarations | `test-api.service.hmrc.gov.uk` | **No legal clearance.** Real EORI and account data; declarations are test-only. |
| **CDS Live** (Production) | **Your organisation** — live customs | `api.service.hmrc.gov.uk` | **Legal.** Duties, clearances, and penalties apply. |

**Plain English:** Trade Test proves *our software* works. TDR lets *you* practise with *your* data. CDS Live is where declarations matter at the border.

---

## What HMRC tells you vs what Freightcode tells you

| Topic | HMRC docs | This guide / product |
|-------|-----------|----------------------|
| OAuth, XML schema, Accept headers | Yes — Service Guide, mapping docs | We implement per [`environment-matrix.md`](./environment-matrix.md) |
| Vendor SDST / Path to Production | Yes — for **Freightcode the supplier** | Internal evidence in `docs/hmrc/ACTIVE/tdr/evidence/` |
| Signing up 50 broker clients into sandbox | **No** | Org-level **Practice mode** (below) |
| When a customer may submit live declarations | Production credentials + trader readiness | **Freightcode platform admin** enables live for the org (customer does not self-serve the toggle) |
| Billing before practice | N/A | Product choice — practice should not require payment |

---

## Customer journey in Freightcode

### Phase 1 — Practice (default)

Every new organisation starts in **Practice mode** (TDR on the sandbox host).

**What the customer sees**

- Banner: *“Practice environment — declarations are not legally binding.”*
- Full declaration workspace: items, documents, dry-run, submit to HMRC TDR, status, notifications, amend/cancel (where TDR allows).
- Connect **HMRC Test User** credentials (Settings → Security) — sandbox OAuth only; **not** live Government Gateway in practice mode
- Invite team members via Clerk organisation; shared declarations within the org.

**What the customer must provide**

- Valid UK EORI (and related account details HMRC expects for TDR — not Trade Test library EORIs).
- Supporting documents for the declaration lane they are testing (e.g. invoice N935).
- Understanding that **acceptance in TDR does not clear goods**.

**What we do not require for practice**

- Production HMRC credentials (those are Freightcode’s, via Developer Hub).
- Stripe subscription (recommended product policy: billing gates **production**, not practice).

### Phase 2 — Production (live customs)

When the organisation is ready for live customs:

1. Customer completes onboarding (billing, production HMRC OAuth with Government Gateway, operational readiness).
2. **Freightcode platform admin** switches the organisation to **live** mode in **Admin → Users & HMRC** (not a customer self-service control).
3. Org `mode` flips to **Live** — submissions route to CDS Live on the production host with production Accept headers and credentials.

**What the customer sees**

- Banner removed or replaced: *“Live CDS — declarations have legal effect.”*
- Same UI; stricter guards (no cross-user test shortcuts, ownership enforced, audit trail).

**What changes technically (product)**

| Setting | Practice (TDR) | Live (CDS) |
|---------|----------------|------------|
| HMRC host | `test-api.service.hmrc.gov.uk` | `api.service.hmrc.gov.uk` |
| Declarations API | v1.0 + `application/vnd.hmrc.1.0+xml` | v2.0 + v2 Accept headers (per matrix when on production host) |
| Legal status | Test only | Legally binding |
| OAuth | Sandbox Developer Hub app | Production Developer Hub app (Freightcode) |

Per-org routing replaces today’s single global `HMRC_ENVIRONMENT` in `.env.local`. Until that ships, **all tenants share the deployment’s env** — document as a known limitation.

---

## Declarations in practice vs live

### Practice (TDR)

- Submissions hit HMRC’s sandbox with TDR rules and real trader data shapes.
- **DMSACC** and other notifications are real HMRC responses for test — useful for training and integration.
- Goods are **not** cleared; duties are **not** legally due; border systems do not act on these MRNs.
- Amend/cancel behaviour follows TDR sandbox timing (e.g. narrow window before sandbox clearance noise — see [`evidence/amend/HOWTO.md`](./evidence/amend/HOWTO.md)).

### Live (CDS)

- Same workflow; outcomes bind the trader.
- Errors, penalties, and payment obligations are real.
- Production fraud-prevention headers, conversation IDs, and notification pull/webhook discipline are mandatory (see [`AGENT-SPEC.md`](./AGENT-SPEC.md) §10).

---

## Organisations and teams

| Concept | Customer meaning | Product rule |
|---------|------------------|--------------|
| **Organisation** | Company or broker desk | Clerk org; declarations scoped by `orgId` |
| **Personal workspace** | Legacy solo data before orgs | Kept for migration; not the default for new teams |
| **Roles** | Admin vs member | Admin requests production; members create/edit declarations |
| **Shared data** | Same declarations for all org members | List/get filtered by active org from JWT |

Customers should create or join an **organisation** for team practice. Personal mode is for existing solo accounts only.

---

## Connecting HMRC

1. Org admin (or user) opens **Settings → Connect HMRC**.
2. **Practice:** sign in with the organisation's **HMRC Test User** (shown in Settings → Security). **Live:** sign in with live Government Gateway.
3. OAuth redirect to HMRC (`test-www` for practice, `www` for live); tokens stored per user with org context.
4. Practice uses sandbox OAuth client; live uses production OAuth client.

**Customer copy (practice):** *“You are authorising Freightcode to submit test declarations on your behalf. Sign in with your HMRC Test User — not your live Government Gateway. Use your real EORI on the declaration.”*

---

## Documents, status, and notifications

- **Dry-run** — always available before submit; validates XML without HMRC call.
- **Submit** — creates conversation ID; store on declaration.
- **Status** — from HMRC Information API only; never invented in the UI.
- **Notifications** — from HMRC webhooks/pull only; DMS codes drive displayed status.

Customers in practice should treat the **notification timeline** as training for live operations.

---

## Financial features in practice

Pre-clearance duty/VAT **estimates** and deferment account (DAN) capture are educational in practice mode:

- Estimates are **indicative** — not a HMRC calculation unless/until live APIs provide them.
- DAN and method of payment fields prepare correct XML for when the org goes live.

See [`FINANCIAL-ROADMAP.md`](./FINANCIAL-ROADMAP.md) for product scope.

---

## Limitations and disclaimers

**For customer-facing copy (Terms / in-app):**

1. Practice declarations have **no legal effect** at the UK border.
2. Freightcode is **not** HMRC; acceptance in TDR is not customs clearance.
3. The customer is responsible for **accurate data** on live submissions.
4. Production access may be **withheld or revoked** if misuse or non-compliance is detected.
5. Availability of sandbox vs live is subject to **HMRC API status** and scheduled maintenance.

**Technical limitations (today):**

- Global env flag — all users on one deployment share the same HMRC phase until per-org routing ships.
- Vendor Trade Test evidence is **internal** — customers must not use TDL EORIs in TDR.

---

## FAQ

**Can I use a made-up EORI in practice?**  
No. TDR expects real declarant account data. Trade Test library EORIs are for vendor assurance only.

**Does DMSACC in practice mean my goods cleared?**  
No. It means HMRC’s test environment accepted the declaration structure.

**Do I need to pay before I practise?**  
Product intent: **no**. Payment aligns with production readiness, not learning the UI.

**Can my broker see all client orgs?**  
Not by default. Each client org is separate; broker-for-client models are a future product pattern.

**What’s the difference between TDR and “sandbox”?**  
In Freightcode UI we say **Practice**; technically it is **TDR v1** on HMRC’s **sandbox host** (`test-api`).

---

## Product build checklist (internal)

What engineering implements to match this guide. **Not yet complete** unless noted.

| # | Capability | Customer-visible | Notes |
|---|------------|------------------|-------|
| 1 | Org `mode`: `practice` \| `live` | Practice / Live badge | Drives HMRC host + Accept headers |
| 2 | Per-org HMRC routing guard | Submit blocked if org live but env sandbox (and vice versa) | Replaces global `.env` only |
| 3 | Practice banner | Amber banner on all declaration routes | **Done** — `PracticeModeBanner` in dashboard layout |
| 4 | Auto practice on sign-up | New org defaults to `practice` | No billing gate |
| 5 | Live mode toggle | Practice / Live badge updates | **Platform admin only** — Admin → Users & HMRC; `setOrgMode` + audit log |
| 6 | Settings HMRC connect | Connect / disconnect | Shipped |
| 7 | Org-scoped declarations | Team sees shared data | Largely done (`orgId` indexes) |
| 8 | Remove billing block for practice | Dashboard without subscription in practice | Policy decision |
| 9 | Customer doc link in app | Help → “Practice vs Live” | Points here |
| 10 | Terms clause | Legal review | Disclaimers § above |
| 11 | Ops runbook row | Who switches org to live | **Freightcode platform admin** — not Clerk org admin |

**Explicitly out of scope for customers**

- Trade Test Data Library workflows
- Direct access to Freightcode vendor SDST evidence packs
- Enterprise tier / white-label (product decision)

---

## Related documents

| Doc | Use |
|-----|-----|
| [`BACKLOG.md`](./BACKLOG.md) | Engineering + product todo (single source) |
| [`AGENT-SPEC.md`](./AGENT-SPEC.md) | Agent/engineering compliance behaviour |
| [`environment-matrix.md`](./environment-matrix.md) | Hosts, Accept headers, API versions |
| [`FINANCIAL-ROADMAP.md`](./FINANCIAL-ROADMAP.md) | Duty estimates, DAN, variance |
| [`../../FUTURE/production/README.md`](../../FUTURE/production/README.md) | Production credentials (future) |
| HMRC CDS End-to-End Service Guide | Official API reference (external) |

---

*Last updated: 2026-06-20 — internal checklist tracked in [`BACKLOG.md`](./BACKLOG.md).*
