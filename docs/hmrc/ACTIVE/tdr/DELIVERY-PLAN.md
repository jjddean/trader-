# Post-TDR backlog

TDR done → [`evidence/LOG.md`](./evidence/LOG.md). **Merge gate:** `npm run test:tdr`

Read top to bottom. Only **Now** is active work; everything below waits until **Now** is checked off.

---

## Now — 1. DAN + payment method

Importers pay duty via a deferment account. Capture it on the declaration and emit it in CDS XML.

| Piece | Status |
|-------|--------|
| Schema (`defermentAccountNumber`, `paymentMethodCode`) | done |
| Financial Records display when set | done |
| Declaration form fields | **not started** |
| `updateDeclarationDetails` saves them | **not started** |
| `wco-mapper.ts` → XML (DE 2/6, DE 4/8) | **not started** |

**Do this, in order:**

1. **`src/app/dashboard/declarations/[id]/page.tsx`** — add DAN + method of payment (default `E`). Save via existing mutation.
2. **`convex/declarations.ts`** — extend `updateDeclarationDetails` args + patch for both fields.
3. **`src/lib/wco-mapper.ts`** — when DAN present, map DE 2/6 (`AdditionalDocument` category DAN) and DE 4/8 on `DutyTaxFee` (MOP `E` per Appendix 9).
4. **`src/lib/h1-xml-renderer.ts`** — only if mapper JSON shape needs new nodes.
5. **`npm run test:tdr`** — must pass. Golden XML unchanged when DAN empty (current lane).
6. Optional: sandbox submit with DAN filled → new row in [`evidence/LOG.md`](./evidence/LOG.md).

**Spec:** [`mapping/de-4-x-valuation.md`](./mapping/de-4-x-valuation.md) (DE 4/8) · Appendix 21A row 2/6 (mandatory when deferment used).

**Done when:** user enters DAN on declaration → dry-run XML contains deferment + MOP → Financial Records shows the account.

- [ ] 1 complete — then move to 2

---

## 2. HMRC connect in Settings

OAuth API works from dashboard home; `/dashboard/settings` has no connect/disconnect UI.

**Done when:** connect and disconnect HMRC from Settings without using dashboard home.

---

## 3. Org / workspace RBAC

Workspaces in schema; declarations still filtered by `userId` only.

**Done when:** two users in same org see the same declarations.

---

## 4. Dashboard duty KPIs

Charts on `/dashboard` are placeholders.

**Done when:** KPIs read from `declaration_preview` / existing analytics queries.

---

## 5. Active lane DE mapping

HS 8471300000, Felixstowe, N935 + N271 — verify every mapped field in [`mapping/`](./mapping/).

**Done when:** each DE file marked complete for the lane; no open gaps vs `passing-payload.xml`.

---

## 6. Playwright smoke

**Done when:** one test — Clerk sign-in → open declaration → dry-run passes in CI.

---

## 7. Ops policies

**Done when:** security + backup one-pagers exist (before production).

- [x] [`security/OPS-SECURITY.md`](./security/OPS-SECURITY.md) · [`security/OPS-BACKUP-DR.md`](./security/OPS-BACKUP-DR.md)

---

## Later

CRM, export/ENS/H2, SaaS billing UI, env submit guard.

Production credentials and config: [`../../FUTURE/production/README.md`](../../FUTURE/production/README.md) · ops log in [`evidence/LOG.md`](./evidence/LOG.md).

