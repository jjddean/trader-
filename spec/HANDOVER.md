# Handover

Freightcode — UK CDS customs declarations SaaS.

| Topic | Location |
|-------|----------|
| Setup & commands | [`README.md`](../README.md) |
| HMRC behaviour (mandatory) | [`docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`](../docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md) |
| Live backlog | [`docs/hmrc/ACTIVE/tdr/BACKLOG.md`](../docs/hmrc/ACTIVE/tdr/BACKLOG.md) |
| B1 / C1 / I1 status | [`docs/hmrc/ACTIVE/tdr/EXPORT-COMPLETION-CHECKLIST.md`](../docs/hmrc/ACTIVE/tdr/EXPORT-COMPLETION-CHECKLIST.md) |
| Security & pen test | [`docs/hmrc/ACTIVE/tdr/security/`](../docs/hmrc/ACTIVE/tdr/security/) |
| TDR sandbox evidence | [`docs/hmrc/ACTIVE/tdr/evidence/LOG.md`](../docs/hmrc/ACTIVE/tdr/evidence/LOG.md) |
| Production cutover | [`docs/hmrc/FUTURE/production/README.md`](../docs/hmrc/FUTURE/production/README.md) |

**Merge gate (HMRC logic):** `npm run test:tdr` (`h1` + `b1` + `c1` + `i1` + `tre` + `tdr-dry-run`). PR gate: `.github/workflows/tdr-regression.yml`.  
**Active env:** TDR v1.0 on sandbox — [`environment-matrix.md`](../docs/hmrc/ACTIVE/tdr/environment-matrix.md)
