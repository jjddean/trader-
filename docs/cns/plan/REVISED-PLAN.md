# CNS integration — revised plan

Date: 8 August 2026. Supersedes the scoping in Part 1 §5.

The original governing spec assumed one operating model: FreightCode filing under
its own CNS badge. That was wrong — FreightCode is pursuing **two** models in
parallel, and CNS has confirmed both. This document replans on that basis.

Every claim below is attributed. Where a choice is mine rather than CNS's, it
says so.

---

## 1. The two models

CNS's own diagram splits the work into two boxes: **Clearing Agent** (claims
inventory in Compass under a badge) and **Entry Software** (files declarations
via the API Gateway using that badge). The models differ only in who owns which
box.

| | Model 1 — managed clearance | Model 2 — software provider |
|---|---|---|
| Clearing Agent | FreightCode | The customer |
| Entry Software | FreightCode | FreightCode |
| Badge | RKA (FreightCode's) | The customer's own |
| CDS account | FreightCode's (SOTFRECCMI) | The customer's own |
| Topic | SOTFRETOP | The customer's own |
| Who claims in Compass | FreightCode | The customer |
| Who pays CNS fees | FreightCode | The customer |
| Status | EUAT configured, testing | Answered by CNS; see §1.2 |

**Source for the per-customer split** — CNS Service Desk, 27 July 2026:
> "We would issue separate badges and CDS Accounts for new Traders for
> Production, against a separate Topic (mailbox)."

So model 2 is N credential sets across N topics — one per customer. Not a shared
gateway credential with badge routing.

### 1.1 CNS has already answered on model 2

CNS Service Desk replied to FreightCode **as a software provider** on 27 July
2026, addressing the third-party model directly:

> "As a software house for TDR we can issue HMRC (CDS) status DMS messages.
> Other reports would not be issued to yourselves as a software provider, none
> are currently provided as XML or API formats."

and, on provisioning:

> "We would issue separate badges and CDS Accounts for new Traders for
> Production, against a separate Topic (mailbox)."

Taken together these settle the model 2 technical contract: per-trader badge,
CDS account and topic, with DMS status notifications as the delivered data.
No further technical question needs answering before building it.

Commercials for model 2 (which fees attach to the customer as badge holder)
follow the same structure as §4 but have not been separately itemised by CNS.

### 1.2 The compliance boundary between them

CNS, in the summary email:
> "You will not be able to complete inventory linked declarations on behalf of
> your client who also have CNS badges that are licenced… The declarant needs to
> use the same badge as assigned to the inventory. It is not permitted compliance
> wise for you to share 1 badge to multiple of your clients… This is not to say
> that Freight Code can't act as the declarant for their clients who are
> requesting Freight Code complete the clearance on their behalf."

Read precisely, this is about **whose badge holds the inventory**, not who the
paying customer is:

- **Permitted (model 1)** — FreightCode claims cargo to RKA and clears it as
  declarant for a client who asked. Normal agency work.
- **Permitted (model 2)** — a badge-holding customer claims to their own badge
  and files through the platform under their own credentials.
- **Forbidden** — a badge-holding customer's entries filed under RKA, or several
  customers sharing one Compass login and submitting on one badge.

The two models are therefore complementary, not alternatives: model 2 serves
exactly the customers model 1 must refuse.

---

## 2. What is already built and serves both models

Parts 2–4, complete and tested (121 tests). None of it is model-specific:

- Canonical CDS XML with the Z/MCR inventory reference
- `fetchCns` transport, SSRF guard, User-Agent, badge header
- Error normalisation and retry disposition
- 202 / X-CSP-ID handling, distinct from the HMRC X-Conversation-ID gate
- Inventory pre-check detection (CDS20001 + blank MRN) and IRC extraction
- Notification envelope parsing, Base64 decode, persist-before-ack, dedupe
- Topic leasing, poll floor, replay
- GPR prohibition
- Original-LRN reuse on amend and cancel

The only model-specific thing in the build is **where credentials come from**:
currently one set in environment variables.

---

## 3. The credential layer — the one piece of new design

This is the work that makes both models one code path.

**Sourced:** each customer has their own badge, CDS account and topic (CNS, 27
July). A badge must be associated with the authenticating account, or the
Gateway returns 403 `INVALID_BADGE_ID` (Customs Declaration API v1.0.3, Error
scenarios).

**My design decisions, not CNS's** — flagged as such, open to challenge:

1. Credentials live in a per-organisation record, not environment variables.
   FreightCode's own RKA becomes one such record rather than a special case, so
   model 1 is model 2 with N=1.
2. Secrets are encrypted at rest, reusing the existing
   `convex/lib/hmrc_token_crypto.ts` pattern rather than inventing another.
3. Environment variables remain as the fallback for FreightCode's own badge, so
   current EUAT testing keeps working while the table is populated.
4. Routing resolves *which* credential set applies, replacing today's
   allow/refuse decision. `cnsBadgeHolder` on `clients` stops meaning "block" and
   becomes "use their own credentials".

**Consequences that follow regardless of design choice:**

- The poller becomes multi-topic: one lease and cycle per topic.
  `cns_poll_state` is already keyed by topic, so it survives unchanged.
- Notification correlation must be scoped by topic as well as by CSP-ID/LRN —
  two customers could in principle issue the same LRN.
- Every credential set needs its own rotation and revocation path.

---

## 4. Constraints that bound the product

**Only DMS status notifications are machine-readable.** CNS Service Desk, 27 July:
> "As a software house for TDR we can issue HMRC (CDS) status DMS messages.
> Other reports would not be issued to yourselves as a software provider, none
> are currently provided as XML or API formats."

This was in answer to a request for inventory records, inventory updates,
container status, customs release and port release messages. So:

- Inventory pre-check rejections **do** arrive, as DMS notifications carrying
  CDS20001 — the detector already keys on this.
- Live inventory state, container status and port release **cannot** be shown in
  the UI from CNS. Compass is manual, browser-only.
- Any roadmap item assuming an inventory feed needs rethinking.

Worth confirming whether this limit changes once approved as a third-party
provider, or whether it was answering an unapproved enquirer. It has not been
confirmed either way.

**Claiming is manual.** The clearing agent claims and assigns shipments in
Compass by hand. There is no claiming API in the supplied pack.

**Commercials attach to the badge holder** — Inventory Licence (quarterly),
transactional fees (UCN, PIN), partner port fees (DP World Southampton, London
Gateway), CDS Gateway API banded tariff. In model 2 these are the customer's
costs. Confirm before pricing.

**The Gateway also carries non-inventory declarations.** The diagram routes both
inventory and non-inventory decs through it. Not required — the direct HMRC path
stays — but it is an available option.

---

## 5. Revised work plan

| Part | Work | Status |
|------|------|--------|
| 1 | Repo map and findings | Done |
| 2 | Transport foundation | Built |
| 3a | Schema and submit route | Built |
| 3b | Amend, cancel, LRN reuse | Built |
| 4 | Notification pipeline | Built |
| **5** | **Credential layer — per-org sets, multi-topic poller, routing resolution** | **Next** |
| 6 | Operator UX — UCN field, badge/route display, IRC errors, guards, Compass link | After 5 |
| 7 | EUAT execution T01–T14 (model 1) | Blocked |
| 8 | Model 2 — customer credential capture, per-customer EUAT | Buildable now (§1.1) |

Part 5 moved ahead of the UX deliberately: the interface has to show which badge
a declaration is filed under, and that cannot be designed before the credential
model is settled.

---

## 6. Live status (8 August 2026)

Verified against CNS EUAT today:

- Authentication works — 200 responses with the issued credentials
- Pull mode available — consumer record present but empty, no push consumer
- Empty-topic handling correct — 204, next poll deferred past the 30s floor
- Lease acquire and release correct, no errors

**Blocked:** heartbeats return 200 but never arrive on `SOTFRETOP`. Tested
repeatedly over ~15 minutes including 94 seconds after a fresh heartbeat; the
topic returns 204 throughout. The consumer call proves the topic path and
credentials resolve, so this is CNS-side routing. Outstanding with the service
desk.

Nothing beyond T03 can run until topic delivery works — without it a declaration
submits and never produces an outcome.

One live-call finding already folded in: CNS returns the consumer record in
element form (`<Consumer><endpointUrl/></Consumer>`), not the attribute form the
v1.0.3 sample documents. The original detection would have missed a configured
push consumer entirely. Both forms now handled, with the actual EUAT response
pinned in a test.
