# DE 1/10 + DE 1/11 — Procedure & Additional Procedure

| | |
|--|--|
| Obligation (H1) | DE 1/10: **A** **X**; DE 1/11: **A** **X** |
| Source — Appendix 1 (DE 1/10) | https://www.gov.uk/government/publications/appendix-1-de-110-requested-and-previous-procedure-codes |
| Source — Appendix 2 (DE 1/11) | https://www.gov.uk/government/publications/appendix-2-de-111-additional-procedure-codes |
| Source — completion guide Group 1 | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-1-message-information-including-procedure-codes |
| Source — DE 1/10 → 1/11 correlation matrix | https://www.gov.uk/government/publications/imports-4-digit-to-3-digit-procedure-code-to-additional-procedure-code-correlation-matrix |
| Retrieved | 2026-05-27 (pending Group 1 + Appendix 1 row paste) |

## Lane

| Field | Value | Status |
|-------|-------|--------|
| DE 1/10 | 4000 | release for free circulation, no previous procedure — Appendix 1 row pending |
| DE 1/11 | 000 | no additional procedure — Appendix 2 row pending |

## Known facts (from Imports Navigation)

> Begin with the relevant Declaration Category data set table in Appendix 21 …
> Use the Index list for the 4-digit Procedure Codes in Appendix 1: Data Element (DE) 1/10: Requested and Previous Procedure Codes to identify the appropriate procedure code …
> The DE 1/10 to DE 1/11 Correlation Matrix should then be used to see which Additional Procedure Codes are permitted with the chosen 4-digit Procedure Code.
> Where the completion rules for a specific data element in Appendix 1: DE 1/10 and Appendix 2: DE 1/11 specify different rules to the main data element completion guidance or other appendices, the rules specified in Appendices 1 and 2 take precedence.

## Pending

```
spec/hmrc-mirror/appendix1-4000.md       ← Appendix 1 row for CPC 4000 (verbatim)
spec/hmrc-mirror/appendix2-000.md        ← Appendix 2 row for APC 000 (verbatim)
spec/hmrc-mirror/de-1-10-1-11-matrix.md  ← matrix line for 4000 → permitted 3-digit APCs
```

## WCO XML mapping (separate question)

WCO `<GovernmentProcedure>` carries:
- `<CurrentCode>` — depending on context = first 2 digits of CPC, OR the APC
- `<PreviousCode>` — last 2 digits of CPC

Exact CDS encoding for `4000 000` is **not** specified in public Tariff Vol 3 — it's a CDS XSD detail.

## Known errors

| Code | Pointer | Meaning |
|------|---------|---------|
| CDS12070 | 70A / 166 | Procedure / additional procedure encoding invalid |
| CDS11004 | document context | CPC + document set mismatch (handled in DE 2/3) |
