# ENS (Safety & Security GB) — FreightCode implementation specification

**Status:** FUTURE — not started

| | |
|--|--|
| HMRC service | Safety & Security GB |
| API version | 1.0 beta |
| Service guide version | 1.10 |
| Specification retrieved | 2026-08-22 |
| Provenance | [`SOURCES.md`](SOURCES.md) |

This document translates HMRC's published specification into FreightCode
engineering requirements. **It does not change any HMRC rule.** Where this
document and a mirror under `api/`, `validation/` or `reference/` disagree, the
mirror wins and this document is wrong.

Nothing here is implemented. No existing CDS behaviour is altered by this pack.

---

## 1. Service architecture

```
FreightCode
    ↓  POST /customs/imports/declarations        (IE315 CC315A)
HMRC S&S Declarations API
    ↓  synchronous
schema validation (4000–4999) + business validation (8000–8999)
    ├── 400 + errorresponse  → no outcome is ever produced
    └── 200 + SuccessResponse → CorrelationId
    ↓  asynchronous
risk processing
    ↓
Outcomes API  GET /customs/imports/outcomes
    ├── accepted → IE328 + MRN
    └── rejected → IE316
    ↓
DELETE /customs/imports/outcomes/{correlationId}   (acknowledge)

Notifications API  GET /customs/imports/notifications
    ↓
IE351 advanced notification / Do Not Load
    ↓
DELETE /customs/imports/notifications/{notificationId}  (acknowledge)
```

Two properties drive the whole design:

1. **Submission is synchronous, the outcome is not.** A 200 means HMRC accepted
   the message, not the declaration. The MRN arrives later, via a different API.
2. **Both asynchronous channels are pull-and-acknowledge.** There is no webhook.
   Unacknowledged items stay on the list, so acknowledgement is what advances
   the queue — and acknowledging before persisting loses the item permanently.

This differs fundamentally from the CDS path already in FreightCode, which
receives notifications by push webhook (`/api/hmrc/webhooks/notify`) with a pull
fallback. ENS is pull-only.

---

## 2. Authentication and common headers

| | |
|--|--|
| Authorisation | OAuth 2.0 user-restricted, Bearer token |
| Scope | `write:import-control-system` — the **only** scope; it covers all three APIs including the read endpoints |
| Accept | `application/vnd.hmrc.1.0+xml` (required, enum of one) |
| Content-Type | `application/xml; charset=UTF-8` (submission endpoints) |
| Sandbox host | `https://test-api.service.hmrc.gov.uk` |
| Production host | `https://api.service.hmrc.gov.uk` |

`<MesSenMES3>` must carry the same EORI the bearer token was issued for, in the
form `EORI/BranchId` — e.g. `GB000000000012/0000000010`. The Branch ID is a
10-digit number chosen by the trader; HMRC does not issue it.

---

## 3. New ENS

| | |
|--|--|
| Endpoint | `POST /customs/imports/declarations` |
| Message | IE315, root element `<ie:CC315A xmlns:ie="http://ics.dgtaxud.ec/CC315A">` |
| Schema | `schemas/declarations/CC315A-v11-2.xsd` |
| Required message type | `<MesTypMES20>CC315A</MesTypMES20>` |
| Success | HTTP 200, `SuccessResponse` carrying `<CorrelationId>` |
| Failure | HTTP 400, `errorresponse` listing every error |

The correlation ID is the only handle on the submission until an MRN exists. It
must be persisted in the same transaction that records the submission — losing it
orphans the declaration, because the Outcomes list is keyed by correlation ID.

No outcome is produced for a submission that failed validation. Do not poll for
one.

---

## 4. Amendment

| | |
|--|--|
| Endpoint | `PUT /customs/imports/declarations/{mrn}` |
| Message | IE313, root element `<ie:CC313A xmlns:ie="http://ics.dgtaxud.ec/CC313A">` |
| Schema | `schemas/declarations/CC313A-v11-2.xsd` |
| Required message type | `<MesTypMES20>CC313A</MesTypMES20>` |
| Success | HTTP 200, `SuccessResponse` with a **new** `<CorrelationId>` |

Two identifiers must agree: `<DocNumHEA5>` in the body and `{mrn}` in the path.
A mismatch is a validation failure, so the amendment builder must take the MRN
once and write it to both places.

An amendment is only possible after an accepted outcome, because the MRN comes
from IE328. Amendments produce their own outcomes — IE304 accepted, IE305
rejected — under the new correlation ID, not the original one.

`<CorIdeMES25>` carries the message correlation of the original.

---

## 5. Outcomes

| Operation | Endpoint |
|-----------|----------|
| List unacknowledged | `GET /customs/imports/outcomes` |
| Retrieve one | `GET /customs/imports/outcomes/{correlationId}` |
| Acknowledge | `DELETE /customs/imports/outcomes/{correlationId}` |

The list returns `<entryDeclarationResponses>` containing `<response>` elements,
each with `<correlationId>` and `<link>`. **Presence of `<MRN>` is the
accept/reject discriminator** — an accepted outcome carries one, a rejection
does not. Do not infer status from anything else at list level.

| Message | Schema | Meaning |
|---------|--------|---------|
| IE328 | `schemas/outcomes/CC328A-v10-0.xsd` | New ENS accepted — carries MRN |
| IE316 | `schemas/outcomes/CC316A-v10-0.xsd` | New ENS rejected |
| IE304 | `schemas/outcomes/CC304A-v10-0.xsd` | Amendment accepted |
| IE305 | `schemas/outcomes/CC305A-v10-0.xsd` | Amendment rejected |

Acknowledgement is a `DELETE` and it is destructive: the outcome leaves the
list. Persist the full outcome body and only then acknowledge. A 404 on
retrieve means nothing is available yet — it is not an error condition.

---

## 6. Notifications and interventions

| Operation | Endpoint |
|-----------|----------|
| List unacknowledged | `GET /customs/imports/notifications` |
| Retrieve one | `GET /customs/imports/notifications/{notificationId}` |
| Acknowledge | `DELETE /customs/imports/notifications/{notificationId}` |

| Message | Schema | Meaning |
|---------|--------|---------|
| IE351 | `schemas/notifications/CC351A-v10-0.xsd` | Advanced notification / **Do Not Load** |

The retrieve response wraps the IE351 in `<notificationResponse>` and includes
an `<acknowledgement method='DELETE' href='...'/>` element giving the exact
acknowledge URL — follow that rather than constructing it.

Intervention detail sits in `CUSINT632`: `CusIntCodCUSINT665` is the customs
intervention code, `CusIntTexCUSINT666` the free text, `IteNumConCUSINT668` the
item it applies to.

**Do Not Load is an operational stop, not an error.** The carrier must not load
the goods. Treated as a normal notification in the UI it will be missed, so it
needs its own severity, its own alert, and it must not be auto-acknowledged.

The service guide is explicit that a client must poll **both** lists —
outcomes and notifications are separate queues and an ENS can produce items on
each.

---

## 7. Data model

Derived from `reference/fields.md` (151 fields, verbatim HMRC) and its generated
form `reference/raw/fields.json`. Requirement letters are HMRC's: **M**
mandatory, **O** optional, **C** conditional. Distribution: 79 M, 37 O, 34 C,
1 "M except for air movements".

Mandatory status must be taken from that file and from the XSD — never from UI
intuition, and never from this table, which names structures rather than fields.

| Group | HMRC structure | Notes |
|-------|----------------|-------|
| Message header | `MesSenMES3`, `MesRecMES6`, `DatOfPreMES9`, `TimOfPreMES10`, `MesIdeMES19`, `MesTypMES20`, `CorIdeMES25` | Sender EORI/Branch, preparation date/time, message id and type |
| ENS header | `HEAHEA` | Includes `DocNumHEA5` (MRN, amendment only), `RefNumHEA4` (LRN), specific circumstance indicator, total gross mass, transport charges method of payment |
| Parties | `TRACONCO1` consignor, `TRACONCE1` consignee, `PERLODSUMDEC` person lodging, `NOTPAR670` notify party, `TRAREP` representative, `CARENT` carrier | A GB EORI on the notify party means the address children **must not** be sent (guide v1.9) |
| Transport | `IDEMEATRAGI970`/`NatIDEMEATRAGI973` identity and nationality of means of transport, `TRAMODATBOR` mode at border, `CONNR2` container numbers | Mode codes: `reference/modes-of-transport.md` |
| Itinerary | `ITI` countries of routing | Sequence matters |
| Places | `CUSOFFFENT730`/`RefNumCUSOFFFENT731` customs office of first entry, `PlaLoaGOOITE334`/`PlaUnlGOOITE334` place of loading/unloading | Office of first entry in Northern Ireland is rejected on the GB service |
| Goods items | `GOOITEGDS` | Item number, description, gross mass, commodity code, marks |
| Packages | `PACGS2` | Kind of package: `reference/package-types.md` |
| Documents | `PRODOCDC2` | Type codes: `reference/document-types.md` (603 entries) |
| Dangerous goods | `UNDanGooCodGDI1` | UN dangerous goods code, numeric pattern |
| Seals | `SEAID529` | Added in guide v1.7 |
| Special mentions | `SPEMENMT2` | Additional information: `reference/additional-information.md` |

FreightCode-side, not HMRC:

| Group | Contents |
|-------|----------|
| Submission metadata | org, user, environment (sandbox/production), submitted-at, request XML hash |
| HMRC correlation | correlation ID, message ID, LRN |
| Outcome | outcome type (IE328/316/304/305), MRN, received-at, acknowledged-at, raw XML |
| Notifications | notification ID, intervention codes, DNL flag, acknowledged-at, raw XML |
| Amendment history | ordered chain of correlation IDs against one MRN |

Environment must be stamped at creation and locked on first submission, exactly
as `declarations.environment` already does for CDS, so a sandbox ENS can never
be replayed at production.

---

## 8. Validation

HMRC performs both layers server-side. FreightCode should perform both
client-side first, to avoid burning submissions.

| Layer | Error range | Local artifact |
|-------|-------------|----------------|
| XML schema | 4000–4999 | `schemas/declarations/CC315A-v11-2.xsd`, `CC313A-v11-2.xsd` |
| Business rules | 8000–8999 | `validation/business-rules.json` |

`validation/business-rules.json` holds **375 rules** — 188 for IE315, 187 for
IE313 — each with `errorCode`, `contextElement` (an absolute XML path such as
`/CC315A/GOOITEGDS`) and the **verbatim** `scenario` text.
`validation/error-codes.json` indexes the 182 distinct codes; 181 are shared
between the two messages, so the rule engine should be written once and
parameterised by message type.

Scenario text was not summarised. The exact condition is the rule, and rules
like

> `[Gross mass] should be present if not ([Specific circumstance indicator] eq 'E' or [Total gross mass])`

cannot survive paraphrase.

Both layers must run before submission. A schema-invalid or business-invalid
submission returns 400 and produces **no outcome**, so a client that polls
regardless will wait forever.

---

## 9. Reference data

Nine code lists, 1,699 entries, mirrored under `reference/` with generated JSON
under `reference/raw/`. See [`SOURCES.md` §6](SOURCES.md).

Loading strategy should follow the existing `cds_code_lists` pattern in
`convex/cds_codes.ts` — seeded rows, validated at submit. Note the fail-open
degradation already documented in `src/app/api/hmrc/submit/route.ts`: an unseeded
list currently lets every code through with a warning. ENS should either seed as
part of deploy or fail closed; silently unvalidated safety-and-security data is
worse than a blocked submission.

---

## 10. Sandbox

Full detail in [`testing/sandbox.md`](testing/sandbox.md). Summary:

| Header | Values | Effect |
|--------|--------|--------|
| `simulateRiskingResponse` | `accept` \| `reject` | Without it **no outcome is ever produced** |
| `riskingResponseError` | `nonUniqueLRN` \| `badTransportMode` \| `badMessageCode` | Selects the rejection; defaults to `badTransportMode` |
| `simulateRiskingResponseLatencyMillis` | integer, capped at 30000 | Delay before the outcome appears |
| `simulateInterventionResponse` | `true` \| `false` | Produces an advanced notification |
| `simulateInterventionResponseLatencyMillis` | integer, capped at 30000 | Delay before the notification appears |

A customs office of first entry in Northern Ireland is rejected regardless of
header value.

---

## 11. Reuse of existing FreightCode infrastructure

Inspected against the current repository.

### Reuse as-is

| Component | Path | Note |
|-----------|------|------|
| OAuth flow and PKCE | `src/lib/hmrc-oauth.ts`, `hmrc-pkce.ts` | Same platform, same authorize host. Only the scope differs |
| Token storage and encryption | `src/lib/hmrc-token.ts`, `hmrc_tokens` table | Already environment-partitioned and encrypted at rest |
| Environment selection | `src/lib/hmrc-config.ts`, `hmrc-org-routing.ts` | Sandbox/production split already solved |
| Live-flip guards | `src/lib/admin-live-flip.ts` | `HMRC_REQUIRE_ORG_LIVE_ON_PROD` should apply to ENS too |
| Audit logging | `src/lib/audit-log.ts` | Wrap in try/catch per the existing convention |
| Org/user security | `canAccessDeclaration` pattern in `convex/declarations.ts` | Reuse the ownership check shape |
| Rate limiting | `src/lib/api-rate-limiter.ts` | |
| Error surfacing | `src/lib/convex-errors.ts`, `convex/lib/user_errors.ts` | Enforced repo-wide by `tests/error-surface-consistency.test.ts` — use `userError()`, not plain throws |
| XML escaping | `src/lib/xml-utils.ts` | `xmlEscape()` on every interpolated value, no exceptions |
| Test infrastructure | `node --test` + tsx, `tests/` | Add `tests/ens/` and a `test:ens` script |

### Extend

| Component | Change needed |
|-----------|---------------|
| `src/lib/hmrc-fetch.ts` | Currently hard-codes CDS concerns — `X-Submitter-Identifier`, declaration Accept headers. ENS needs `application/vnd.hmrc.1.0+xml` and no submitter header. Extend by parameter; do not fork. |
| Scope handling | The OAuth flow requests CDS scopes. `write:import-control-system` must be added to the requested set, and consent re-obtained for existing users. |
| `convex/schema.ts` | New tables — ENS declarations, outcomes, notifications. Do not overload `declarations`, which is CDS-shaped. |

### Build new

| Component | Why |
|-----------|-----|
| CC315A / CC313A builders | Entirely different message family from WCO CDS. No overlap with `wco-mapper.ts`. |
| XSD-backed validation | CDS has no local XSD validation. ENS ships usable schemas, so validate against them directly rather than reimplementing rules. |
| Business-rule engine for ENS | The existing `convex/lib/rule_engine.ts` is CDS-shaped. Either extend its `triggerScope` or run ENS rules separately from `business-rules.json`. |
| Poller for both queues | ENS is pull-only. `src/lib/hmrc-pull-notifications.ts` is built around the CDS two-step pull and does not fit. |
| Acknowledgement ledger | Nothing in the CDS path has destructive-read semantics. |

**Do not** duplicate the OAuth, token, environment, audit or rate-limiting
layers. Every one already handles the multi-environment, encrypted, org-scoped
case ENS needs.

---

## 12. Proposed source layout

Following the repository's actual conventions — API routes under
`src/app/api/hmrc/`, pure logic in `src/lib/`, persistence in `convex/`.

```
src/lib/ens/
  ens-config.ts            hosts, Accept/Content-Type, scope
  ens-fetch.ts             thin wrapper over the extended hmrc-fetch
  cc315-builder.ts         ENS record → CC315A XML
  cc313-builder.ts         ENS record → CC313A XML
  ens-xsd-validator.ts     local XSD validation against schemas/
  ens-rules.ts             business rules loaded from business-rules.json
  ens-response-parser.ts   SuccessResponse / errorresponse
  outcome-parser.ts        IE328 / IE316 / IE304 / IE305
  notification-parser.ts   IE351, intervention codes, DNL detection
  ens-reference-data.ts    the nine code lists

src/app/api/hmrc/ens/
  submit/route.ts          POST new ENS
  amend/route.ts           PUT amendment
  outcomes/route.ts        list + retrieve + acknowledge
  notifications/route.ts   list + retrieve + acknowledge

convex/
  ens_declarations.ts
  ens_outcomes.ts
  ens_notifications.ts
  ens_poller.ts            cron-driven pull of both queues

tests/ens/
  cc315-builder.test.ts
  cc313-builder.test.ts
  xsd-conformance.test.ts  mirrors tests/h1/xsd-structure.test.ts
  business-rules.test.ts
  outcome-parser.test.ts
  notification-parser.test.ts
```

`tests/ens/xsd-conformance.test.ts` should follow the pattern already
established in `tests/h1/xsd-structure.test.ts`, but here it can do **true**
XSD validation rather than structural checking, because HMRC ships complete
schemas — which the CDS side does not.

---

## 13. Build phases

### A — Domain and data model
Convex tables for ENS declarations, outcomes, notifications, amendment history.
TypeScript types generated from `reference/raw/fields.json`.
*Depends on:* nothing.
*Done when:* a full ENS can be persisted and read back, environment-stamped,
org-scoped, with the CDS `declarations` table untouched.

### B — XML generation and XSD validation
CC315A and CC313A builders; local validation against the shipped schemas.
*Depends on:* A.
*Done when:* the builders reproduce `validSubmission.xml`, `CC315A_reduced.xml`
and `validAmendment.xml`, and every generated document validates. Note that
`CC315A_full.xml` and `CC313A_reduced.xml` are **not** valid instances — see
`SOURCES.md` §4.

### C — Business-rule validation
Rules driven from `validation/business-rules.json`, parameterised by message.
*Depends on:* B.
*Done when:* every one of the 375 rules is either enforced or explicitly listed
as deferred with a reason. No rule may be silently dropped.

### D — Declarations API client
Submit and amend, correlation ID persistence, `errorresponse` mapping.
*Depends on:* B, C, and the OAuth scope extension.
*Done when:* a sandbox submission returns a correlation ID that is durably
stored before the response is returned to the caller.

### E — Outcome processing and MRN
Poll, retrieve, persist, then acknowledge. MRN onto the declaration.
*Depends on:* D.
*Done when:* accepted and rejected outcomes are both handled, acknowledgement
happens only after durable persistence, and a crash between the two cannot lose
an outcome.

### F — Amendments
MRN-keyed amendment with the `DocNumHEA5`/path consistency guard.
*Depends on:* E.
*Done when:* an amendment chain is queryable and IE304/IE305 land against the
right correlation ID.

### G — Notifications and interventions
Second poller, intervention parsing, Do Not Load handling.
*Depends on:* D.
*Done when:* a DNL raises a distinct high-severity alert, is never
auto-acknowledged, and is visible without opening the declaration.

### H — UI
Create, submit, track, amend; outcome and intervention timeline.
*Depends on:* E, F, G.
*Done when:* an operator can file an ENS and see its outcome without a
developer.

### I — Sandbox test suite
All five simulation headers; the matrix in `testing/test-scenarios.md`.
*Depends on:* D–G.
*Done when:* every scenario in that matrix runs green in CI against sandbox, or
is documented as not simulatable.

### J — Production readiness
Live-flip guard, credential separation, rate limits, monitoring, audit
completeness, penalty-policy review (`reference/penalties.md`).
*Depends on:* all.
*Done when:* the same bar the CDS path had to clear for TDR.

---

## 14. Version protection

This pack is external regulatory infrastructure. Treat it as a stored artifact,
not a cache.

- Do not overwrite it on a later run. Re-download to a scratch location and
  diff.
- Record every re-retrieval in [`CHANGELOG_TRACKING.md`](CHANGELOG_TRACKING.md).
- Watch for changes to: schema element or type changes; field requirement
  changes; new or removed error codes; endpoint or header changes; code-list
  additions or removals; the service guide changelog version.
- The current baseline is **service guide v1.10, API v1.0 beta, retrieved
  2026-08-22**.
