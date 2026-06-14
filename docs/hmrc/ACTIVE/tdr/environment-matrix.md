# CDS Environment Matrix — TT / TDR / Live

**Source:** HMRC CDS End-to-End Service Guide — Developer Set Up / Path to Production

## Freightcode (current)

| Setting | Value | Evidence |
|---------|-------|----------|
| Developer Hub app | **freightcode** sandbox `b74874e9-957e-4a40-b426-0cde839f8a45` | `docs/hmrc/ARCHIVE/trade-test/sdst-evidence-pack/evidence/01-application-details.md` |
| OAuth | Sandbox client ID on **test-api** | Same file — production application ID **pending** |
| Active phase | **TDR v1.0 Declarations** on sandbox host | `docs/hmrc/ACTIVE/tdr/evidence/early-attempts/tdr-cds-v1-dry-run.json` |
| Env | `HMRC_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_HMRC_ENV=tdr` | `.env.local` |

Production host (`api.service.hmrc.gov.uk`) and production OAuth credentials are **future** — when SDST issues them (`docs/hmrc/FUTURE/production/`).

**Archived:** Trade Test v2.0 (Declarations `2.0+xml` on sandbox) — `docs/hmrc/ARCHIVE/trade-test/`

**Doc conflict resolved (2026-06-14):** `AGENT-SPEC.md` §2 previously said TDR runs on production host — **wrong for current phase**. Canonical active config is **sandbox + `NEXT_PUBLIC_HMRC_ENV=tdr`** until G3 production credentials. `hmrc-operations-runbook.md` production-host notes apply only after SDST sign-off.

## API versions

| API | Trade Test | TDR (Freightcode now) | TDR (production host, future) | CDS Live |
|-----|------------|----------------------|-------------------------------|----------|
| Customs Declarations | v2.0 | **v1.0** | **v1.0** | v2.0 |
| Customs Declarations Information | v1.0 | **v1.0** (sandbox host) | v2.0 | v2.0 |
| Pull Notifications | v1.0 | v1.0 | v1.0 | v1.0 |

## API hosts

| Phase | Base URL | Freightcode status |
|-------|----------|-------------------|
| Trade Test / TDR (sandbox app) | `https://test-api.service.hmrc.gov.uk` | **Active** |
| TDR / CDS Live (production OAuth) | `https://api.service.hmrc.gov.uk` | Pending production credentials |

## Accept headers (TDR v1 — Freightcode sandbox)

| Operation | Accept header |
|-----------|---------------|
| Submit / amend / cancel declaration | `application/vnd.hmrc.1.0+xml` |
| Status query (Information API, sandbox host) | `application/vnd.hmrc.1.0+xml` |
| Pull notifications | `application/vnd.hmrc.1.0+xml` |

When on production host (future): Information API → `application/vnd.hmrc.2.0+xml`.

## Data policy

| Phase | Party / account data |
|-------|---------------------|
| Trade Test | Trade Test Data Library EORIs (sandbox) — **archive only** |
| TDR | Real declarant EORI, DAN, authorisations |
| CDS Live | Production trader accounts |
