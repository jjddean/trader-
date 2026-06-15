# Operations security one-pager

**Product:** Freightcode (freightcode.co.uk) · **Last updated:** 2026-06-15  
**Detail:** [`documentation/R_and_D/information_security_policy.md`](../../../../documentation/R_and_D/information_security_policy.md)

---

## Architecture

| Layer | Provider | Role |
|-------|----------|------|
| Web + API | Vercel (Next.js 16) | App Router, HMRC proxy, webhooks |
| Data + realtime | Convex (`glorious-marlin-243`) | Declarations, notifications, auth-gated mutations |
| Auth | Clerk | Sign-in, JWT for Convex |
| Payments | Stripe (webhook on Convex HTTP) | Subscriptions |
| HMRC | CDS via server-side `fetchHmrc()` only | No browser-direct HMRC calls |

---

## Secrets

- Stored in **Vercel** (Next.js) and **Convex dashboard** env — never in git.
- Webhook auth: `HMRC_WEBHOOK_AUTH_TOKEN`, `NOTIFICATION_INGEST_SECRET`, `STRIPE_WEBHOOK_SECRET`, `SYNC_SECRET`, `INGEST_SECRET`.
- Fail closed if unset (no default secrets in `convex/http.ts`).

---

## Access control

- **Clerk middleware** (`src/proxy.ts`): `/dashboard/*` requires sign-in.
- **Convex:** mutations/queries call `ctx.auth.getUserIdentity()`; ownership checks on declarations/items.
- **Internal-only:** Stripe webhook handler, audit `logAction`, reference seed, subscription updates.

---

## Webhooks

| Endpoint | Auth |
|----------|------|
| `POST /api/hmrc/webhooks/notify` | Bearer token + constant-time compare; ingest secret to Convex |
| `POST …/stripe-webhook` | Stripe signature verification |
| `POST …/ingest-email` | `X-Ingest-Secret` header |
| `POST …/hmrc-sync-trigger` | Bearer `SYNC_SECRET` |

Production HMRC webhook logs: metadata only (no payload body preview).

---

## AI routes

- Clerk auth required on `/api/ai/*`.
- Rate limit: 20 req/min/user (configurable via `AI_RATE_LIMIT_PER_MINUTE`).
- Upload cap: 10 MB (`AI_MAX_UPLOAD_BYTES`).

---

## Compliance artefacts

| Document | URL / path |
|----------|------------|
| Privacy | https://www.freightcode.co.uk/privacy |
| Terms | https://www.freightcode.co.uk/terms |
| Pen-test checklist | [`PEN-TEST-CHECKLIST.md`](./PEN-TEST-CHECKLIST.md) |
| Backup / DR | [`OPS-BACKUP-DR.md`](./OPS-BACKUP-DR.md) |

---

## Incident contact

Engineering: info@freightcode.co.uk · On-call via Vercel/Convex dashboards.
