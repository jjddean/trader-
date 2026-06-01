# CDS Errors → Spec Mapping

Source policy: DMSREJ is negative evidence only. This file tracks which spec section each error code belongs to; resolution requires that section to cite HMRC.

## Active lane DMSREJ history

> **Important** — all rejections listed below were submitted with location code `GBAUFXTFXTGW`, which **does not appear in Appendix 16C ODS (2026-05-18)**. They are not informative about XML shape; they are informative only about HMRC's response to an invalid Appendix 16C value. See `de-5-23-goods-location.md`.

| Timestamp (UTC) | LRN | MRN | Errors | Notes |
|-----------------|-----|-----|--------|-------|
| 2026-05-27 18:50 | FC-MPOF5NYN | 26GB5TQNYETNXMJAR6 | 11 | Submitted `GBAUFXTFXTGW` with split (Name suffix + Type A + Address U/GB) → CDS12099 L016/L110/410 + cascade |
| 2026-05-27 19:08 | FC-MPOFESH9 | 26GB5TQX2GIE9A6AR9 | 12 | Same — `GBAUFXTFXTGW` invalid |
| 2026-05-27 19:31 | FC-MPOGMY8W | 26GB5TS58D1NYVRAR0 | 11 | Submitted `GBAUFXTFXTGW` with Name+ID only (no Type/Address) → CDS10001 on L110 + 04A + 410 + cascade |
| 2026-05-27 20:12 | FC-MPOI2U6O | 26GB5TTL49EEAG1AR0 | 11 | First submission with **valid Appendix 16C code** `GBAUFXTFXTFXT` (Name+ID only shape). Same CDS10001 on L110 + 04A + 410 — confirms missing Type/Address elements, not invalid code. Also: 12073 (header/item country conflict — Seller/Buyer/Origin blank), 12056 (Representative + AI), 12077 (DutyTaxFee + Origin/preference), 12005/R123 (transport), 12005/R038 (supervising office). Triggered inference decision for DE 5/23 split shape — see `de-5-23-goods-location.md`. |
| 2026-05-27 20:32 | FC-MPOISWS0 | 26GB5TUB6ZMD0MHAR0 | 10 | First submission with DE 5/23 split shape (`ID` + `TypeCode` + `Address[TypeCode + CountryCode]`). CDS10001 on 64A GONE. New CDS12070 at `64A/L016` and `64A/04A/410`. Mis-interpreted L016 as top-level CountryCode. Origin still blank — uncovered uncited `originCountry === dispatchCountry` omit in `wco-mapper.ts`; removed (Group 5 says DE 5/15 always mandatory). |
| 2026-05-28 ~10:30 | n/a | n/a | XSD reject | HMRC XSD validator returned `BAD_REQUEST / xml_validation_error: cvc-complex-type.2.4.a: Invalid content was found starting with element 'CountryCode'. One of '{Address}' is expected.` Definitive proof CountryCode at GoodsLocation root is NOT in the schema. Reverted to Address.CountryCode (nested). L016 pointer in business-rule DMSREJ refers to `Address.CountryCode` — pointer chain truncates path. |
| 2026-05-31 19:02 | TT-1780254160221 | n/a | XSD reject | Single controlled submit returned HTTP 400, `X-Conversation-ID: 4a09777f-8490-41cb-9b47-abab4e3cc8fc`. HMRC XSD validator returned `BAD_REQUEST / xml_validation_error`: empty `DeclarationOfficeID` is invalid, and `GoodsShipment/Consignment` was rejected in the stale scenario-runner XML sequence (`Consignment` where `{Warehouse}` was expected). Not a DMSREJ; no business-rule count update. Fix scope: stop the submit runner using its stale duplicate XML builder and route it through the app mapper/renderer. |
| 2026-05-31 21:00 | TT-1780261221319 | pending | HTTP 202 | Controlled resubmit after runner fix returned HTTP 202, `X-Conversation-ID: 357a2553-b074-4151-ae89-c2b0a3742783`. This is envelope acceptance only; no DMSACC/DMSREJ has been pulled or pasted yet. `spec/passing-payload.xml` remains pending until actual DMSACC. |
| 2026-05-31 21:03 | FC-MPU9NSCQ | 26GB5ZL62L96SAEAR5 | 8 | App submit DMSREJ, FunctionCode `03`, FunctionalReferenceID `0f69ddc8a87e4d818f218222c3cbcfb1`. Errors: 2x CDS12073 (`42A` + `67A/103`; `42A` + `67A` + item `68A/103`), 2x CDS12070 (`42A/67A/28A/64A/04A/410`; `42A/67A/28A/64A/L016`), 2x CDS12056 (`42A/05A`; `42A/67A/68A/03A/226`), 2x CDS12005 (`42A/57B/R123`; `42A/67A/74A/R038`). Confirms current count is 8 business-rule errors. No DMSACC; do not freeze `passing-payload.xml`. |
| 2026-05-31 21:19 | FC-MPUA8FWM | 26GB5ZLQQ4438YLAR5 | 6 | App submit after DE 5/23 `Name + TypeCode + Address(TypeCode, CountryCode)` change. CDS12070 on `64A/L016` and `64A/04A/410` is gone — GoodsLocation family burned down. Remaining: 2x CDS12073 (`42A` + `67A/103`; `42A` + `67A` + item `68A/103`), 2x CDS12056 (`42A/05A`; `42A/67A/68A/03A/226`), 2x CDS12005 (`42A/57B/R123`; `42A/67A/74A/R038`). |
| 2026-05-31 ~21:25 | n/a | n/a | XSD reject | HMRC XSD validator rejected item sequence after adding self-representation AI `00500`: `Invalid content was found starting with element 'AdditionalDocument'... One of '{AdditionalInformation, AEOMutualRecognitionParty, Buyer, Commodity, ...}' is expected.` Cause: renderer emitted item `AdditionalInformation` before `AdditionalDocument`; CDS schema requires `AdditionalDocument` before `AdditionalInformation`. Fixed renderer order and added regression assertion. Not a DMSREJ; business-rule count remains last known 6. |
| 2026-05-31 21:29 | FC-MPUAL5NT | 26GB5ZM3FXPHLV3AR6 | 6 | App submit after XSD sequence fix + item `00500` AI. **CDS12056 gone** (was `05A` + `03A/226`). **CDS12070 moved to `03A`**: `42A/67A/68A/03A/226` and `42A/67A/68A/03A/225` (relation error on `AdditionalInformation` — mapper emits `StatementCode` only). Unchanged: 2× CDS12073 (`42A/67A/103`; `42A/67A/68A/103`), 2× CDS12005 (`42A/57B/R123`; `42A/67A/74A/R038`). FunctionalReferenceID `9bec8039b4ed4cfe86f8333531db8771`. |
| 2026-05-31 21:49 | FC-MPUBBYAS | 26GB5ZMU8G20OLOAR5 | **4** | App submit after Appendix 4A fix: `00500` + `StatementDescription` **Importer**. **CDS12070 on `03A` cleared** (both `225`/`226` gone). **CDS12056 still clear.** Unchanged: 2× CDS12073 (`42A/67A/103`; `42A/67A/68A/103`), 2× CDS12005 (`42A/57B/R123`; `42A/67A/74A/R038`). FunctionalReferenceID `826601ca815a4457804e41e9eac05d09`. |
| 2026-06-01 00:15 | FC-MPUGJ6M8 | 26GB5ZS1HTC883LAR0 | **4** | App submit after DE 4/1 `TradeTerms/LocationID` `GBFELIXSTOWE`. **No error-count change.** Same 2× CDS12073 (`42A/67A/103`; `42A/67A/68A/103`), 2× CDS12005 (`42A/57B/R123`; `42A/67A/74A/R038`). FunctionalReferenceID `c76aef075e63481cb8a6cb3549ea67e8`. XML inspection: see conversation 2026-06-01 — all `CountryCode`/`ExportCountry`/`Origin` fields unchanged vs FC-MPUBBYAS. |

## Code → spec section

| Code | DE pointer | Spec section |
|------|------------|--------------|
| CDS10001 | varies | per DE — "mandatory data element missing" |
| CDS10020 | 22B / L002 | `de-4-x-valuation.md` (DE 4/1 LocationID) |
| CDS11004 | 02A | `de-2-3-documents.md` |
| CDS12005 / R123 | 57B | `de-7-x-transport.md` — rule R123 source pending |
| CDS12005 / R038 | 74A | `de-3-x-parties.md` — rule R038 source pending |
| CDS12056 | 05A | `de-3-x-parties.md` (Agent / Representative — DE 3/19–3/21) |
| CDS12056 | 03A / 226 | DE 2/2 AdditionalInformation — needs Appendix 4 paste |
| CDS12070 | 70A / 166 | `de-1-10-procedures.md` |
| CDS12070 | 39B / 188 | `de-4-x-valuation.md` (ValuationAdjustment) |
| CDS12070 | 03A / 225 / 226 | `de-3-x-parties.md` (DE 2/2 AI `00500` — StatementCode present; paired field missing per relation error) |
| CDS12073 | 67A 103 / 68A 103 | `de-4-x-valuation.md` (DE 4/1 location) + `de-5-23-goods-location.md` — fix attempt: emit `TradeTerms/LocationID` `GBFELIXSTOWE` per Group 4 |
| CDS12073 | 57A | `de-3-x-parties.md` (Exporter combination) |
| CDS12077 | 23A / 50A / 164 | `de-4-x-valuation.md` (DutyTaxFee) |
| CDS12077 | 92A / 501 | `de-4-x-valuation.md` / Origin |
| CDS12099 | 64A / L016 / L110 / 04A / 410 | `de-5-23-goods-location.md` — invalid combination for DE 5/23 |
| CDS77002 | 02A | `de-2-3-documents.md` (status code missing) |

## Resolution protocol

For each code:

1. Find its DE.
2. Open the spec file for that DE.
3. Verify the spec file cites HMRC for the specific value being submitted.
4. If the cited HMRC content does not match what the submission sent → fix submission to match HMRC.
5. If the cited HMRC content does match → STOP. Do not change XML. Open an HMRC SDS ticket.

## R123 / R038 — rule source pending

Tariff Vol 3 does not publish the named CDS rules (R001…R200). These appear only in the CDS error code definitions list and DMSREJ pointer chains. Need:

- HMRC's CDS error code definitions document (separate from Tariff Vol 3)
- Or HMRC SDS direct response

Until then, R123 and R038 errors **cannot be fixed by mapper changes** under the spec policy.
