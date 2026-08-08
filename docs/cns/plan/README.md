# CNS Inventory-Linked Imports — plan

**Start with [REVISED-PLAN.md](REVISED-PLAN.md)** — 8 August 2026. It supersedes
the scoping in Part 1 and covers both operating models. The parts below remain
accurate as build records.

| Part | Contents | Status |
|------|----------|--------|
| [Part 1 — Repo map & findings](part-1-repo-map.md) | M0 discovery, the eight findings that shape the design, schema changes | Done |
| [Part 2 — Transport foundation](part-2-transport-foundation.md) | Config, client, errors, routing, inventory XML | Built |
| [Part 3a — Schema & submit route](part-3-route-integration.md) | Schema fields, new tables, convex/cns.ts, submit wired | Built |
| [Part 3b — Amend & cancel](part-3-route-integration.md#part-3b--amend-and-cancel) | CNS branch reusing the original LRN, nil/blank retrigger | Built |
| [Part 4 — Notification pipeline](part-4-notification-pipeline.md) | Convex poller, persist-before-ack, correlation, replay | Built |
| Part 5 — Credential layer | Per-org credential sets, multi-topic poller, routing resolution | Next |
| Part 6 — Operator UX | UCN field, badge/route display, IRC errors, guards, Compass link | After 5 |
| Part 7 — EUAT execution | T01–T14, model 1 | Blocked on topic delivery |
| Part 8 — Model 2 | Customer credential capture, per-customer EUAT | Buildable now |

## Testing

```
npm run test:cns     # 121 tests
npm run test:h1      # 125 tests — regression on the direct HMRC path
```

## Sources

- Governing spec: `FreightCode_CNS_Inventory_Linked_Imports_Implementation_Specification_v1.1.docx`
  — accurate for model 1; scoped model 2 out, which REVISED-PLAN corrects
- CSP CDS Interface Specification — Customs Declaration API v1.0.3
- CSP CDS Interface Specification — Notification APIs v1.0.3
- CNS Service Desk correspondence, 27 July – 6 August 2026
- Getting Ready for CDS Exports — MUCR Formatting (exports phase only, unused)
