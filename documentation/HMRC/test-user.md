# HMRC Test User

Sandbox / Trade Test test user issued from the HMRC Developer Hub Create Test User API.
Do **not** use these credentials in production.

---

## Yasmine Kerr

| Field | Value |
|-------|-------|
| User ID | `564716008843` |
| Password | `` |UvyjIAG8ooEQ
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

---

## Notes
- `.env.local` `HMRC_EORI` is set to `GB243617410764` to match this user.
- Switching test users requires updating that env var, restarting `npm run dev`, and re-running the OAuth flow (sign in with this User ID + Password) so the persisted token is tied to the right HMRC account.
