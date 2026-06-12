# Amend (COR) — SDST retest 2026-06-12

**API:** `POST /customs/declarations/amend` (FunctionCode 13, TypeCode COR).

| Field | Value |
|-------|-------|
| Date (UTC) | 2026-06-12 ~16:03–16:22 |
| Submit LRN | FC-MQB2EYRG |
| Amend LRN | AM-pavtfg1qbbzrmyspb8n88gs5s-03P1Y2 |
| MRN | 26GB6GDX92A21TIAR0 |
| Amend X-Conversation-ID | 4a267b1b-b7e4-4ce8-b9cf-d4e2a3be5b6e |
| Amend HTTP | 202 |
| DMSRES (FC 07) | 2026-06-12 15:22:37 UTC (`20260612152237Z`) |
| VersionID | **2** |
| Amended value | GBP **8000.00** (DE 4/14 + DE 4/11 co-amend) |
| CDS Status in app | **Amended (DMSRES)** |
| Change | Item price COR (DE 4/14 + co-amend DE 4/11) |

Result: **PASS** — dedicated amend endpoint + DMSRES FC07 on Trade Test v2.0.

Raw notification: `response-dmsres-26GB6GDX92A21TIAR0.xml`
