# ENS sandbox behaviour

**Status:** ACTIVE — reference data only

> Source: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/import-control-entry-declaration-store/1.0 (section "Testing")
> Also: https://developer.service.hmrc.gov.uk/guides/safety-and-security-import-declarations-end-to-end-service-guide/documentation/set-up.html
> Retrieved: 2026-08-22
> Full verbatim mirrors: [`../api/declarations.md`](../api/declarations.md), [`../api/service-guide-set-up.md`](../api/service-guide-set-up.md)

| | |
|--|--|
| Sandbox host | `https://test-api.service.hmrc.gov.uk` |
| Production host | `https://api.service.hmrc.gov.uk` |
| Scope | `write:import-control-system` |

---

## 1. The rule that governs all sandbox testing

**Without `simulateRiskingResponse`, no outcome is ever produced.**

HMRC's wording: "If the header is omitted or has any other value then no risking
simulation will be performed and no outcome will be made available for an ENS
submission."

A test that submits an ENS and then polls the Outcomes API without setting this
header will poll forever and the failure will look like a broken poller. Every
sandbox test that expects an outcome must set it.

The same applies to notifications: no `simulateInterventionResponse`, no
advanced notification.

---

## 2. Test headers

All five are set on the **submission** request (`POST /customs/imports/declarations`
or `PUT /customs/imports/declarations/{mrn}`). None are set on the Outcomes or
Notifications APIs — those simply return what the submission's headers caused to
be created.

### `simulateRiskingResponse`

| Value | Effect |
|-------|--------|
| `accept` | Positive outcome and an MRN, against the submission's correlation ID |
| `reject` | Negative outcome and error details, against the submission's correlation ID |
| omitted / anything else | No risking simulation, **no outcome at all** |

### `riskingResponseError`

Only meaningful when `simulateRiskingResponse: reject`.

| Value | Simulated scenario |
|-------|--------------------|
| `nonUniqueLRN` | Local reference number in the declaration is not unique |
| `badTransportMode` | Transport mode is not supported |
| `badMessageCode` | Message code is not supported |

Default when `reject` is set with no error header: **`badTransportMode`**.

### `simulateRiskingResponseLatencyMillis`

Delay between submission and the outcome becoming available, in milliseconds.
Values above `30000` are treated as 30 seconds. Omitted means no delay.

### `simulateInterventionResponse`

Takes `true` or `false`. When `true`, an advanced notification is associated
with the submission's correlation ID. Omitted or any other value produces no
notification.

### `simulateInterventionResponseLatencyMillis`

Delay before the advanced notification becomes available. Same 30-second cap.

---

## 3. Northern Ireland override

If the customs office of first entry `<RefNumCUSOFFFENT731>` is in Northern
Ireland, **a rejection is issued regardless of the header value**. HMRC states
this twice, under both `simulateRiskingResponse` and `riskingResponseError`.

This is not only a sandbox behaviour — the Level 2 validation mirror records
that the live service also rejects submissions with a Northern Ireland office of
first entry on the GB service.

Test fixtures must therefore use a GB office of first entry unless the NI
rejection is the thing under test.

---

## 4. What the sandbox does and does not do

From the service guide set-up page. The test environment will:

- accept ENS declarations and ENS amendments
- validate against **both** the schema and the business rules
- collect, acknowledge and list unacknowledged responses
- simulate risking responses, returning MRN and error-code scenarios

It will **not**:

- allow performance or load testing

An S&S GB test user may be required. The service guide does not document a
create-test-user endpoint specific to this service — see [`../SOURCES.md` §7](../SOURCES.md).

---

## 5. Latency and polling

Both latency headers cap at 30 seconds. A test harness should therefore:

- set an explicit latency when testing the poller's retry behaviour
- allow at least 30 seconds before declaring an outcome missing
- never treat HTTP 404 on retrieve as a failure — it means "not available yet"

---

## 6. Acknowledgement is destructive

`DELETE /customs/imports/outcomes/{correlationId}` and
`DELETE /customs/imports/notifications/{notificationId}` remove the item from
the unacknowledged list. In sandbox as in production, an acknowledged item
cannot be re-fetched.

Test order matters: retrieve and assert on the body **before** acknowledging,
and give acknowledgement its own assertion rather than folding it into the
retrieve test.
