# ENS implementation test matrix

**Status:** FUTURE — not started

Every scenario below is derived from documented HMRC sandbox behaviour
([`sandbox.md`](sandbox.md)). Nothing here has been executed — no call, sandbox
or production, has been made from this repository against the ENS APIs.

Header shorthand:
`sRR` = `simulateRiskingResponse`,
`rRE` = `riskingResponseError`,
`sIR` = `simulateInterventionResponse`,
`*LatencyMillis` = the matching latency header.

---

## 1. Submission — happy path

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 1 | Valid ENS accepted, MRN issued | `validSubmission.xml`, `sRR: accept` | 200 + `SuccessResponse` with `CorrelationId`; outcome appears as IE328 carrying `<MRN>`; MRN persisted against the declaration |
| 2 | Reduced data set accepted | `CC315A_reduced.xml`, `sRR: accept` | As above. Confirms the BTOM reduced set builds and validates |
| 3 | Correlation ID persisted before response | `sRR: accept` | Correlation ID durably stored before the route returns. Kill the process between submit and store — the record must not be orphaned |

## 2. Submission — validation failures

These never produce an outcome. A poller must not wait for one.

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 4 | Schema error | Malformed CC315A — e.g. `MesSenMES3` not matching `[A-Z]{2}[^\n\r]{1,15}/[0-9]{10}` | 400 + `errorresponse`; error code in **4000–4999**; no outcome created |
| 5 | Business-rule error | Valid XML violating a Level 2 rule — e.g. duplicate item number (8102) | 400 + `errorresponse`; code in **8000–8999**; no outcome created |
| 6 | Multiple errors | Document breaking several rules | Every error listed, not just the first |
| 7 | Local validation catches it first | Same payloads as 4 and 5 | FreightCode rejects before any HTTP call is made; HMRC never sees it |

## 3. Risking rejections

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 8 | Non-unique LRN | `sRR: reject`, `rRE: nonUniqueLRN` | IE316 rejection; reason surfaced to the operator |
| 9 | Bad transport mode | `sRR: reject`, `rRE: badTransportMode` | IE316 rejection |
| 10 | Bad message code | `sRR: reject`, `rRE: badMessageCode` | IE316 rejection |
| 11 | Default rejection reason | `sRR: reject`, no `rRE` | Behaves as `badTransportMode` |
| 12 | Rejection carries no MRN | any of 8–11 | Outcome list entry has **no** `<MRN>`; the declaration must not be marked accepted |

## 4. Northern Ireland override

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 13 | NI office of first entry | `RefNumCUSOFFFENT731` in NI, `sRR: accept` | Rejected **despite** `accept`. Confirms the override, and that our code does not assume the header dictates the result |

## 5. Amendment

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 14 | Valid amendment accepted | Accepted ENS from 1, then `validAmendment.xml` via `PUT /customs/imports/declarations/{mrn}`, `sRR: accept` | 200 + **new** `CorrelationId`; IE304 outcome |
| 15 | Amendment rejected | As 14 with `sRR: reject` | IE305 outcome |
| 16 | MRN mismatch guard | `DocNumHEA5` ≠ `{mrn}` in the path | Rejected. Ideally caught locally before submission |
| 17 | Amendment before MRN | Amend a declaration with no accepted outcome | Blocked locally — there is no MRN to address |
| 18 | Amendment chain | Two amendments against one MRN | Both correlation IDs recorded in order against the same MRN |

## 6. Outcomes

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 19 | List unacknowledged | Two submissions, one accept one reject | Both in `<entryDeclarationResponses>`; accepted one has `<MRN>`, rejected one does not |
| 20 | Retrieve by correlation ID | `GET /customs/imports/outcomes/{correlationId}` | Full outcome XML; parses to the right message type |
| 21 | Retrieve before available | Poll immediately with a latency header set | HTTP 404 handled as "not yet", not as an error |
| 22 | Latency respected | `sRR: accept`, `simulateRiskingResponseLatencyMillis: 5000` | No outcome before ~5s; present after |
| 23 | Latency cap | `simulateRiskingResponseLatencyMillis: 90000` | Treated as 30s |
| 24 | Acknowledge | `DELETE /customs/imports/outcomes/{correlationId}` | 200; item leaves the unacknowledged list |
| 25 | Persist before acknowledge | Fail between retrieve and DELETE | Outcome still stored; no data lost. **This is the ordering that matters most** |
| 26 | Acknowledge twice | DELETE the same correlation ID twice | Second returns 404; handled without error |

## 7. Notifications and interventions

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| 27 | Advanced notification produced | `sRR: accept`, `sIR: true` | Notification appears on the notifications list |
| 28 | No notification without the header | `sRR: accept` only | Notifications list stays empty |
| 29 | List notifications | As 27 | `listInterventions` response with notification ID + correlation ID |
| 30 | Retrieve notification | `GET /customs/imports/notifications/{notificationId}` | IE351 in `<notificationResponse>`; `<acknowledgement>` element gives the DELETE href |
| 31 | Do Not Load handling | IE351 with a DNL intervention | Distinct high-severity alert; **not** auto-acknowledged; visible without opening the declaration |
| 32 | Intervention detail parsed | IE351 with `CUSINT632` | `CusIntCodCUSINT665`, `CusIntTexCUSINT666`, `IteNumConCUSINT668` all captured |
| 33 | Acknowledge notification | `DELETE /customs/imports/notifications/{notificationId}` | 200; leaves the list |
| 34 | Notification latency | `sIR: true`, `simulateInterventionResponseLatencyMillis: 5000` | Delay honoured |
| 35 | Both queues polled | `sRR: accept`, `sIR: true` | Outcome **and** notification both collected. Guards against polling only one list |

## 8. Cross-cutting

| # | Scenario | Expected |
|---|----------|----------|
| 36 | Environment isolation | A sandbox ENS can never be submitted to production. Same lock as `declarations.environment` |
| 37 | Scope missing | Token without `write:import-control-system` fails with a clear message, not a generic 500 |
| 38 | Org scoping | One org cannot read another's ENS, outcome or notification |
| 39 | Audit trail | Submit, outcome and acknowledgement each produce an audit entry; an audit failure never breaks the main operation |
| 40 | XSD conformance | Every generated CC315A and CC313A validates against the shipped schemas before submission |

---

## Notes for whoever builds this

`CC315A_full.xml` and `CC313A_reduced.xml` are **not** valid instances — they
carry placeholder values and fail HMRC's own schema. Use `validSubmission.xml`,
`CC315A_reduced.xml` and `validAmendment.xml` as fixtures. See
[`../SOURCES.md` §4](../SOURCES.md).

Scenario 25 is the one most likely to be got wrong and least likely to be caught
by a green test suite. Acknowledgement is a destructive read: acknowledge before
persisting and the outcome is gone from HMRC with no way to re-fetch it.
