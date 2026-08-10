# Part 4 — Notification pipeline

Status: **built and tested.** No live poll yet — blocked on the password.

This is the half that turns a 202 into an actual outcome. Without it a CNS
submission has no result: CNS returns receipt only, and inventory linking, CDS
acceptance, duty and clearance all arrive asynchronously on the topic.

---

## Files

| File | Purpose |
|------|---------|
| [convex/lib/cns_config.ts](../../../convex/lib/cns_config.ts) | Config for the Convex runtime, Basic auth builder |
| [convex/lib/cns_notification_client.ts](../../../convex/lib/cns_notification_client.ts) | Consumer check, heartbeat, batch, acknowledge |
| [convex/cns_notifications.ts](../../../convex/cns_notifications.ts) | Leasing, persistence, correlation, processing, health |
| [convex/crons.ts](../../../convex/crons.ts) | 60s poll trigger |

## The ordering is the contract

Notification APIs v1.0.3 §10, tightened in that version specifically to state
notifications are acknowledged once **persisted**, not once processed:

```
lease topic → GET batch → persist every envelope → DELETE-ack → parse
```

Acknowledging before persisting risks permanent loss — CNS may delete an
acknowledged message at any time and is not required to redeliver it.
Acknowledging only after parsing risks the opposite: a parser defect would cause
endless redelivery of the same batch. This ordering loses nothing and blocks
nothing.

## Decisions

**One poller per topic, enforced by lease.** Requesting a new batch before
acknowledging the previous one causes unacknowledged messages to reappear in the
next batch. The lease is held in `cns_poll_state` with an expiry, so a crashed
poller frees the topic rather than wedging it.

**The 30s floor lives in the data, not the cron.** The cron fires every 60s but
the action self-gates on `nextPollAt`, which is set to `pollIntervalSeconds`
after an empty read and to `0` after a successful acknowledgement — v1.0.3
permits an immediate re-read in that case.

**Duplicates are acknowledged, not skipped.** `persistNotification` dedupes on
topic + notification id and reports whether it inserted. Either way the id goes
into the acknowledgement, because the row is already durable. Redelivery
therefore produces no second timeline event.

**Correlation tries CSP-ID and LRN before ConversationID.** On an inventory
pre-check rejection there is no ConversationID and the MRN is blank, so those two
are the only usable keys. `submissions.by_cspId` and `by_lrn` carry it.

**An uncorrelated notification is not marked processed.** It records a
`parserError` and stays visible. Marking it done would hide a real problem behind
a green tick.

**A decode failure keeps the raw body.** The base64 is persisted before decoding,
so the row is replayable once the cause is understood — never re-polled, since
CNS may already have dropped it.

**CILE notifications are retained as `unsupported_phase_2`,** never discarded.
They are the samples the export parser will be built against.

**Inventory rejection sets `inventory_rejected`, not a CDS rejection state.** The
declaration never reached CDS; the remediation is the Compass record, not the
declaration.

## Runtime constraint

Convex's default runtime has no Node globals. Everything under `convex/lib/cns_*`
uses `atob`/`btoa`, `TextEncoder`/`TextDecoder` and `fetch` only. The Basic auth
builder UTF-8 encodes before `btoa`, since `btoa` throws above U+00FF and a CSP
password is not guaranteed to be ASCII — covered by a test.

## Verification

`npm run test:cns` 116 pass · `npm run test:h1` 125 pass · typecheck clean · lint clean.

The mutations and actions are integration surface and are not unit-tested here;
they are exercised by T02, T03, T07, T08 and T14 in the EUAT plan.

## First live call

`checkTopicConsumer` before enabling the poller. If a push consumer is attached
to `SOTFRETOP`, batch reads return 423 and pull is unavailable until it is
removed. The action detects and reports this explicitly rather than failing
opaquely.
