# Freightcode

UK customs declarations SaaS — WCO-compliant XML to HMRC CDS for importers and brokers.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend:** Convex (real-time BaaS)
- **Auth:** Clerk
- **HMRC:** CDS v1.0 (TDR sandbox) via server-side proxy

## Quick start

```bash
npm install
npm run dev          # Next.js on :3000
npx convex dev       # Convex watch mode (separate terminal) — required after convex/ changes
```

Copy `.env.local` from your team secrets store. Required keys are listed in `CLAUDE.md`.

**Important:** Next.js and Convex deploy separately. After editing `convex/*`, run `npx convex dev` so your dev deployment (`CONVEX_DEPLOYMENT` in `.env.local`) matches the client.

## Tests

```bash
npm run test:tdr     # H1 unit tests + dry-run gate (merge gate)
npx tsc --noEmit     # TypeScript check
```

## HMRC documentation

All compliance behaviour is defined in:

- [`docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`](docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md) — canonical behaviour spec
- [`docs/hmrc/ACTIVE/tdr/DELIVERY-PLAN.md`](docs/hmrc/ACTIVE/tdr/DELIVERY-PLAN.md) — post-TDR backlog
- [`docs/hmrc/ACTIVE/tdr/security/`](docs/hmrc/ACTIVE/tdr/security/) — readiness audit + remediation log

Active environment: TDR v1.0 on sandbox (`HMRC_ENVIRONMENT=sandbox`). See `docs/hmrc/ACTIVE/tdr/environment-matrix.md`.

## Security notes

- HMRC API calls are server-side only (`src/lib/hmrc-fetch.ts`)
- Stripe webhooks: `https://<deployment>.convex.site/stripe-webhook`
- Notification ingest requires `NOTIFICATION_INGEST_SECRET` in Convex + Next.js env
