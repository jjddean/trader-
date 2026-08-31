# Financial Features Roadmap (Post-TDR)

**Status:** ACTIVE — roadmap; the DAN prerequisite is complete.

Validated against HMRC and UK Trade Tariff guidance.

**Prerequisite:** DAN (Duty Deferment Account Number) support — **complete**.

DAN = DE 2/6 (Deferred Payment) and is required when using deferment payment methods in CDS.

References:

- CDS Completion Guide — DE 2/6 Deferred Payment: [Group 2](https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-2-references-of-messages-document-certificates-and-authorisations)
- Method of Payment codes (DE 4/8): [Appendix 9 / DE 4/8 MOP](https://www.gov.uk/government/publications/method-of-payment-codes-for-data-element-48-of-the-customs-declaration-service)

---

## 1. Auto Tariff Refresh (TTL + Cron)

Basis:

- Trade Tariff API is the authoritative source for commodities, measures, duties, quotas and preferences.

References:

- https://docs.trade-tariff.service.gov.uk/
- https://www.api.gov.uk/hmrc/gov-uk-trade-tariff-api/

Requirements:

- Cache commodity responses
- Date-aware refresh
- TTL-based invalidation
- Scheduled refresh job
- Commodity-level version tracking

Principle:

Tariff data must come from HMRC / Trade Tariff sources, never AI.

**Repo note:** Manual `refreshCommodity` + daily cron `refresh-stale-tariff-cache` (7-day TTL, batch 15/run). Prefer `uk/api/commodities` + `Accept: application/vnd.hmrc.2.0+json`. OAuth when volume grows.

---

## 2. Deterministic Duty Rate Parser

Basis:

Duty, preference and quota calculations should be derived from tariff measures.

References:

- https://uktrade.github.io/tariff-data-manual/documentation/data-structures/measures.html

Requirements:

- Parse measure types
- Parse preference eligibility
- Parse quota measures
- Country-specific filtering
- Deterministic TypeScript implementation

Principle:

AI may explain calculations but must never determine duty rates.

**Repo note:** `convex/lib/duty_rate_parser.ts` — parses MFN/preference duty measures from cached Trade Tariff JSON; wired into `computeDeclarationFinancials` when `tariff_cache` has the commodity. HMRC DMSTAX still overrides confirmed amounts.

---

## 3. Pre-Clearance Cost Estimate

Basis:

CDS remains the source of truth for final assessed amounts.

Reference:

- [Group 4 — Valuation information and taxes](https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-4-valuation-information-and-taxes)

Requirements:

- Estimated duty
- Estimated import VAT
- Estimated border charges
- Visible confidence labels
- Clear "Estimate Only" wording

Principle:

Users must never confuse estimates with HMRC-assessed amounts.

**Repo note:** `getDeclarationFinancialEstimate` + `PreClearanceEstimate` component on declaration workspace; uses `computeDeclarationFinancials` (declared preference/origin). Preference checker savings shown as optional hint only.

---

## 4. Estimate vs HMRC Variance Alerts

Basis:

Compare FreightCode estimates against HMRC-confirmed tax notifications.

References:

- https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/notifications.html

Requirements:

- Compare estimated vs confirmed values
- Highlight variance thresholds
- Surface A00 duty differences
- Surface B00 VAT differences
- Audit trail of estimate revisions

Principle:

HMRC-confirmed values always override estimates.

**Repo note:** Partial foundation via `declaration_preview.financialSource` (`hmrc_confirmed` vs `derived`).

---

## 5. Potential Reclaim Tracker

Basis:

Identify declarations that may qualify for repayment claims.

Reference:

- https://www.gov.uk/guidance/how-to-claim-a-repayment-of-import-duty-and-vat-if-youve-overpaid

Requirements:

- Potential reclaim flag only
- Track C285 eligibility
- Store supporting evidence references
- Track preference-origin opportunities
- Track duty overpayment opportunities

Restrictions:

- Never state that money is recoverable
- Never state that a claim will succeed
- Always present as a potential reclaim opportunity

Principle:

FreightCode identifies opportunities; HMRC determines eligibility.

---

## Core Financial Principles

- HMRC is the source of truth.
- Trade Tariff is the source of truth.
- All financial calculations must be deterministic TypeScript.
- AI explains results only.
- No AI-generated duty rates.
- No AI-generated VAT amounts.
- No AI-generated reclaim values.
- All estimates must be clearly labelled.

---

## Delivery Order

| Step | Feature | Status |
|------|---------|--------|
| 1 | DAN support (DE 2/6 + DE 4/8) | **Done** |
| 2 | Deterministic duty parser | **Done** |
| 3 | Auto tariff refresh | **Done** |
| 4 | Pre-clearance estimates | **Done** |
| 5 | Variance alerts | Next |
| 6 | Potential reclaim tracker | Pending |
