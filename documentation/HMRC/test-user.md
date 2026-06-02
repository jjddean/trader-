# HMRC Test User

Sandbox / Trade Test test users from the HMRC Developer Hub Create Test User service.
Do **not** use these credentials in production.

---

## Active — Romwan Lee (2026-06-02)

Created via Developer Hub **Individual** generate flow. Use for OAuth and declaration party IDs (Declarant + Importer).

| Field | Value |
|-------|-------|
| User ID | `084775438190` |
| Password | `bDaynqtCNFyJ` |
| Full Name | Romwan Lee |
| Email Address | romwan.lee@example.com |
| Date of Birth | 1949-03-30 |
| Address | 6 Finchley Road, Poole, TS12 1PA |
| EORI | `GB531765313922` |
| NINO | `JK045410B` |
| Self Assessment UTR | `8447258530` |
| VAT Registration Number | `126298654` |
| VAT Registration Date | 2025-06-02 |
| Making Tax Digital ITSA ID | `XSIT00989930770` |
| Group Identifier | `238119081662` |
| Taxpayer Type | Individual |

Individual details (JSON from HMRC):

```json
{"firstName":"Romwan","lastName":"Lee","dateOfBirth":"1949-03-30","address":{"line1":"6 Finchley Road","line2":"Poole","postcode":"TS12 1PA"}}
```

---

## Previous — Yasmine Kerr

| Field | Value |
|-------|-------|
| User ID | `564716008843` |
| Password | `` |UvyjIAG8ooEQ |
| Full Name | Yasmine Kerr |
| Email Address | yasmine.kerr@example.com |
| Date of Birth | 1987-12-07 |
| Address | 49 Waterloo Gardens, Verwood, TS13 1PA |
| EORI | `GB243617410764` |
| NINO | `YA418774A` |
| Self Assessment UTR | `9361730549` |
| Corporation Tax UTR | `1971402321` |
| VAT Registration Number | `439672709` |
| VAT Registration Date | 2020-04-23 |
| LISA Manager Reference | `Z007338` |
| Pension Scheme Admin ID | `a0631237` |
| Employer Reference | `938/M3DLSSOFNP` |
| CRN | `3767464745` |
| Making Tax Digital ITSA ID | `XWIT00290301089` |
| Excise Number | `OGbCvjYVlPHUm` |
| SET Reference Number | `111122224008` |
| Pillar 2 ID | `XIPLR0805461396` |
| Group Identifier | `484962900674` |
| Taxpayer Type | Individual |
| Organisation Name | Company 4NVXFV |
| Organisation Address | 48 Virgil Street, Ventnor, TS10 1PA |

Used through FC-MPVNPBLP; CDS12005 R123/R038 on EORI `GB243617410764`.

---

## Notes

- **Trade Test party IDs:** Use a **Test Data Library** EORI, not a Dev Hub–only EORI. See `spec/hmrc-mirror/trade-test-data-library.md` and `spec/hmrc-mirror/cds12005-party-id.md`. Lane default: `GB553202734852`.
- Create sandbox user via API: `{ "serviceNames": ["customs-services"], "eoriNumber": "GB553202734852" }` then OAuth with returned credentials.
- Set `.env.local` `HMRC_EORI` to match declaration Declarant/Importer; restart dev; re-run OAuth after any EORI change.

### Dev Hub users (not recognised on Trade Test for party DEs)

| User | EORI | Result |
|------|------|--------|
| Yasmine Kerr | `GB243617410764` | FC-MPVNPBLP — 2× CDS12005 |
| Romwan Lee | `GB531765313922` | FC-MPWQSJ97 — same 2× CDS12005 |
