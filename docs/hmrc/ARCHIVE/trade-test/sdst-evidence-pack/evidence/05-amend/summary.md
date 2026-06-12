# Amend — §4.4 evidence (success)

| Field | Value |
|-------|-------|
| Date (UTC) | 2026-06-05T11:12:02Z |
| Submit LRN | `FC-MQ0TDTJA` |
| Amend LRN | `AM-kn7ce59qgf4szvq174agcnm4ns880s39` |
| MRN | `26GB664W3BLIFZFAR4` |
| Amend conv | `01382a81-5000-408f-9c99-5215852f5758` (HTTP 202) |
| HMRC outcome | **DMSRES** FunctionCode **07** — amendment accepted |
| VersionID | **2** |
| Changed field | `ItemChargeAmount` GBP **8000.0** (ChangeReasonCode `21`) |

## Files

| File | Content |
|------|---------|
| `response-dmsres-26GB664W3BLIFZFAR4.xml` | Success notification (archive) |
| `response-fc02-26GB664W3BLIFZFAR4.xml` | Prior FC02 response (no errors) |
| `response-dmsinv-26GB664W3BLIFZFAR4.xml` | Earlier CDS13000 rejects on other MRNs |
| `reference-TT_IM002b_Amendment.xml` | HMRC request shape |
| `reference-TT_IM002b_DMSRES.xml` | HMRC success notification shape |

## Builder

`src/lib/hmrc-amendment-xml.ts` — TypeCode COR, TT_IM002b pointers.
