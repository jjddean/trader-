# FreightCode

UK customs declarations SaaS: WCO-compliant XML submitted to HMRC CDS for importers and brokers.

FreightCode is a **live production application**. It supports HMRC CDS declaration workflows. TDR is an HMRC testing/submission environment, not the production status of FreightCode itself; TDR may still be used for testing, validation, onboarding, or a configured organisation’s HMRC path. Application-live does not mean every declaration is sent to live CDS. Hosts, credentials, and routing: [`docs/hmrc/ACTIVE/tdr/environment-matrix.md`](docs/hmrc/ACTIVE/tdr/environment-matrix.md) and [`AGENT-SPEC.md`](docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md) §2. Trade Test archives are not an implementation source.

This README is the repository front door. It does not define HMRC behaviour, agent operating rules, or module completion state. Those live in the documents listed under [Documentation](#documentation).

## Capabilities

**In product scope** (intended; not a completeness claim):

| Area | What it is | Where status lives |
|------|------------|--------------------|
| CDS declarations | H1 import, B1 export, C1 simplified export, I1 simplified import | [`EXPORT-COMPLETION-CHECKLIST.md`](docs/hmrc/ACTIVE/tdr/EXPORT-COMPLETION-CHECKLIST.md) |
| CNS | Optional inventory-linked path beside direct HMRC. First launch is software-vendor-only (each trader’s own badge and topic) | [`AGENTS.md`](AGENTS.md) (product sequence) · [`docs/cns/plan/`](docs/cns/plan/) (build plan) |
| Export controls | LITE draft packs inside this app. Does not submit to government licensing systems | [`docs/export-controls/BUILD-PLAN.md`](docs/export-controls/BUILD-PLAN.md) |
| Adjacent modules | Client portal, TRE import, Stripe billing, onboarding | Implementation under `src/` and `convex/`. Do not treat file presence as “done.” |

Authoritative HMRC/CDS behaviour is [`docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`](docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md), not the current code.

## Stack

| Layer | Technology |
|-------|------------|
| App | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Radix |
| Backend | Convex (separate deploy from Next.js) |
| Auth | Clerk |
| HMRC | Server-side only (`src/lib/hmrc-fetch.ts`). Clerk middleware is `src/proxy.ts` |
| Search | UK Trade Tariff API + Convex reference tables. Do not add Typesense. |
| Payments | Stripe |
| Deploy | Vercel (Next.js) and Convex, independently |

## Repository map

| Path | Role |
|------|------|
| `src/app/` | Next.js App Router (dashboard, portal, API routes) |
| `src/lib/` | CDS mapping/rendering, HMRC client, shared libraries |
| `convex/` | Convex schema, queries, mutations, HTTP actions |
| `tests/` | Category and module tests (`h1`, `b1`, `c1`, `i1`, `tre`, `cns`, `export-controls`, …) |
| `docs/hmrc/ACTIVE/tdr/` | Current HMRC/TDR specs, mapping, backlog |
| `docs/export-controls/` | Export-controls module plan |
| `docs/cns/plan/` | CNS module plan |
| `.github/workflows/tdr-regression.yml` | Pull-request / `main` merge gate |

## Documentation

Specifications define **intended** behaviour. Tests, CI and `package.json` are evidence of **what the repository currently runs**. Code is the implementation and may be wrong. The full authority and conflict procedure is in [`CLAUDE.md`](CLAUDE.md).

| Need | Document |
|------|----------|
| Agent operating contract, verification gates, coding rules | [`CLAUDE.md`](CLAUDE.md) |
| Agent communication / what an agent may do unasked | [`AGENTS.md`](AGENTS.md) |
| Safety rules (datasets, tariff/VAT, secrets, search) | [`.cursorrules`](.cursorrules) |
| HMRC/CDS behaviour (validation, mapping, submit, notifications) | [`docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`](docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md) |
| HMRC/TDR current work index | [`docs/hmrc/ACTIVE/tdr/BACKLOG.md`](docs/hmrc/ACTIVE/tdr/BACKLOG.md) |
| B1 / C1 / I1 completion state | [`docs/hmrc/ACTIVE/tdr/EXPORT-COMPLETION-CHECKLIST.md`](docs/hmrc/ACTIVE/tdr/EXPORT-COMPLETION-CHECKLIST.md) |
| Hosts, Accept headers, OAuth | [`docs/hmrc/ACTIVE/tdr/environment-matrix.md`](docs/hmrc/ACTIVE/tdr/environment-matrix.md) |
| Data-element mapping | [`docs/hmrc/ACTIVE/tdr/mapping/`](docs/hmrc/ACTIVE/tdr/mapping/) |
| HMRC reference mirrors | [`docs/hmrc/specs/`](docs/hmrc/specs/) |
| HMRC docs index | [`docs/hmrc/README.md`](docs/hmrc/README.md) |
| Export-controls module plan | [`docs/export-controls/BUILD-PLAN.md`](docs/export-controls/BUILD-PLAN.md) |
| CNS module plan | [`docs/cns/plan/`](docs/cns/plan/) |
| Required boot env names | [`CLAUDE.md`](CLAUDE.md) §9 |

`BACKLOG.md` is the live **HMRC/TDR** index. Export-controls and CNS keep their own ACTIVE plans; they are not TDR-BACKLOG items. How to treat that split is in `CLAUDE.md`.

**Not current implementation instructions:** [`docs/hmrc/ACTIVE/tdr/DELIVERY-PLAN.md`](docs/hmrc/ACTIVE/tdr/DELIVERY-PLAN.md) (superseded by BACKLOG), [`docs/hmrc/FUTURE/CDS-EXPANSION-BUILD-PLAN.md`](docs/hmrc/FUTURE/CDS-EXPANSION-BUILD-PLAN.md) (superseded by the export completion checklist), [`docs/ARCHIVE/`](docs/ARCHIVE/), [`docs/hmrc/ARCHIVE/`](docs/hmrc/ARCHIVE/), [`docs/hmrc/FUTURE/production/`](docs/hmrc/FUTURE/production/) (HMRC production-host / CDS Live cutover material — not a statement that FreightCode the application is pre-production; do not start unasked), [`documentation/`](documentation/) (retired stubs).

## Setup

```bash
npm install
npm run dev          # Next.js (default :3000)
npx convex dev       # Convex watch — required after convex/ changes
```

Next.js and Convex are separate deployments. After editing `convex/`, run `npx convex dev` so the deployment named by `CONVEX_DEPLOYMENT` in `.env.local` matches the client.

Copy `.env.local` from the team secrets store. Do not commit secrets. Required boot keys and subsystem prefixes are listed in [`CLAUDE.md`](CLAUDE.md) §9. Next.js (Vercel) env and Convex env are not shared.

There is no `engines` field in `package.json`. CI uses Node 22 (`.github/workflows/tdr-regression.yml`).

```bash
npm run build        # Next.js production build (also a CI step)
```

`npx convex deploy` only with explicit authorisation.

## Verification

Script bodies: `package.json`. Exact CI step order: [`.github/workflows/tdr-regression.yml`](.github/workflows/tdr-regression.yml). Gate tables: [`CLAUDE.md`](CLAUDE.md) §7.

Neither of these is the full merge gate:

```bash
npm run test:tdr     # test:h1 + test:b1 + test:c1 + test:i1 + test:tre + test:tdr-dry-run
npm run test:all     # test:unit + test:h1 + test:tre + test:cns + test:portal + test:export-controls + test:consultant + test:tdr-dry-run
```

`test:all` is **not** a superset of `test:tdr`: it does not run B1, C1 or I1. `test:tdr` does not run unit, CNS, portal, export-controls, consultant, audit, typecheck, security lint, or build.

The pull-request / `main` gate is **`.github/workflows/tdr-regression.yml`**. It is wider than both npm scripts (audit, `tsc --noEmit`, `lint:security`, the category tests including B1/C1/I1, CNS, portal, export-controls, consultant, TDR dry-run, and `npm run build`). Playwright (`test:e2e`, `test:e2e:auth`) and repo-wide `npm run lint` are not in that workflow.

Use the smallest matching script from `package.json` while working; do not treat a green `test:all` or `test:tdr` as “CI will pass.”

```bash
npx tsc --noEmit
npm run lint:security
```

## Current work

- HMRC/TDR product and engineering index: [`docs/hmrc/ACTIVE/tdr/BACKLOG.md`](docs/hmrc/ACTIVE/tdr/BACKLOG.md)
- HMRC behaviour for any CDS change: [`docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`](docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md)
- Other modules: their ACTIVE plans above, not BACKLOG
