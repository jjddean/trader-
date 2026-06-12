# CDS Notification Specifications (data)

Behaviour: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`

## Official sources

- CDS End-to-End Service Guide — notification types (DMSACC, DMSREJ, DMSINV, DMSCLE, DMSTAX, etc.)
- HMRC CDS Technical Documentation — notification XML schemas

## Trade Test samples (archive — not for TDR implementation)

| Type | Path |
|------|------|
| DMSACC | `docs/hmrc/ARCHIVE/trade-test/sdst-evidence-pack/evidence/03-notifications/` |
| TT notification reality | `docs/hmrc/ARCHIVE/trade-test/sdst-evidence-pack/evidence/03-notifications/TRADE-TEST-REALITY.md` |
| Pull notifications | `docs/hmrc/ARCHIVE/trade-test/sdst-evidence-pack/evidence/08-pull-notifications/` |
| FC-MPYAJ7RN audit | `docs/hmrc/ARCHIVE/trade-test/evidence/passing/notification-audit-FC-MPYAJ7RN.md` |

## Code

- Parser: `src/lib/hmrc-notification-parser.ts`
- Status precedence: `convex/lib/notification_status.ts`

TDR evidence: `docs/hmrc/ACTIVE/tdr/evidence/`
