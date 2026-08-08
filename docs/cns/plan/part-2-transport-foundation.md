# Part 2 — Transport foundation

Status: **built and tested.** No live CNS call made — none is possible until the
password is set. Everything here is verified against the published spec examples.

Prerequisite reading: [Part 1](part-1-repo-map.md), particularly findings §2.4
(the 202 divergence) and §2.7 (LRN reuse).

---

## What was built

| File | Purpose |
|------|---------|
| [src/lib/cns/config.ts](../../../src/lib/cns/config.ts) | Typed config + startup validation (spec §4.3) |
| [src/lib/cns/client.ts](../../../src/lib/cns/client.ts) | `fetchCns()` — Basic auth, badge, User-Agent, SSRF guard |
| [src/lib/cns/errors.ts](../../../src/lib/cns/errors.ts) | Error normalisation and retry disposition (spec §6.4) |
| [src/lib/cns/routing.ts](../../../src/lib/cns/routing.ts) | Transport selection (spec §5.1) |
| [src/lib/cns/inventory-xml.ts](../../../src/lib/cns/inventory-xml.ts) | MCR previous document, GPR guard, fixture comparison (spec §7) |
| [src/lib/cns/declarations.ts](../../../src/lib/cns/declarations.ts) | submit/amend/cancel transport, 202 handling |
| [convex/lib/cns_envelope.ts](../../../convex/lib/cns_envelope.ts) | Batch envelope parse, Base64 decode, classification |
| [convex/lib/cns_inventory_reject.ts](../../../convex/lib/cns_inventory_reject.ts) | CDS20001 pre-check detection, IRC extraction |

One line changed in existing code: [wco-mapper.ts](../../../src/lib/wco-mapper.ts)
gained an optional `cnsUcn` map option that appends the Z/MCR previous document.
The direct HMRC path emits byte-identical XML when it is unset — covered by a test.

Tests: `npm run test:cns` — 88 tests. `npm run test:h1` — 125 existing tests still pass.

---

## Decisions taken, and why

**`fetchCns` is a sibling of `fetchHmrc`, not an extension.** The direct path is
OAuth Bearer plus the `Gov-*` fraud-prevention set; CNS is HTTP Basic plus
`X-Badge-ID`. Merging them would put an OAuth token and a CSP password in one
code path. `fetchCns` builds the Basic credential at call time and never logs,
returns or persists it.

**`X-Badge-ID` is sent on declarations and deliberately omitted on notifications.**
Notification APIs v1.0.3 §9 marks the badge filter "(Not used by CNS)"; sending it
risks a 403 against a topic routing multiple badges.

**Routing refuses rather than falling back.** If a declaration sits at a CNS
inventory-linked location but can't legitimately go that way — no UCN, org not
entitled, client separately badged — `selectDeclarationTransport` throws instead
of returning `hmrc_direct`. A silent fallback would send a frontier declaration
for an inventory-linked port straight to CDS with no CSP pre-check, and the port
cannot release against it.

**Errors carry a disposition, not just a status.** `stop_configuration`,
`stop_payload`, `retry_backoff`, `outcome_unknown`. This is what stops a 504 from
being recorded as a rejection when CNS may still have forwarded the declaration.

**The MCR mapping is isolated to one file.** Spec §7.2 requires proving it with
the first EUAT declaration. `INVENTORY_REFERENCE_TYPE_CODE` in `inventory-xml.ts`
is the single point of change if it turns out wrong.

**The inventory pre-check detector is conservative.** It requires CDS20001 *and*
a blank MRN. Declaration API v1.0.3 notes the E0-equivalent DMSRCV also carries
CDS20001 — with an MRN present the declaration did reach CDS, so treating it as a
pre-check failure would tell the operator to fix the wrong thing. Both boundary
cases are tested.

---

## Not yet wired

These modules are complete but nothing calls them yet. The submit/amend/cancel
routes still take the direct HMRC path unconditionally — that is Part 3, together
with the schema fields the routing decision needs to persist.

## Configuration required before Part 6

See Part 1 §6. Environment variables are listed in the governing spec Appendix A.
`CNS_ENABLED` defaults to false; nothing in this part activates without it.
