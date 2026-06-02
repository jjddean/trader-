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
| 2026-06-01 20:23 | FC-MPVNPBLP | 26GB60Z7LNJXBB7AR9 | **2** | App submit after renderer emits `GoodsShipment/TransactionNatureCode` **11** (DE 8/5, WCOID 103). **CDS12073 cleared** (both `67A/103` and `68A/103` gone). Unchanged: 2× CDS12005 (`42A/57B/R123`; `42A/67A/74A/R038`). FunctionalReferenceID `eb9f9750e5a9415ab1d84f3383969434`. EORI `GB243617410764`. |
| 2026-06-02 14:38 | FC-MPWQSJ97 | 26GB622ATBJB8W5AR2 | **2** | App submit with Dev Hub EORI `GB531765313922` (Romwan Lee). **Same 2× CDS12005** R123 + R038. Payload verified: Declarant + Importer = `GB531765313922`, 00500 + Importer, TransactionNatureCode 11. **Conclusion:** Dev Hub–generated EORIs are not Trade Test–recognised party IDs — use **Test Data Library** EORI (`spec/hmrc-mirror/cds12005-party-id.md`). FunctionalReferenceID `1fa4163e11dc4a47abe0d01e133ecfb7`. |

## Code → spec section

| Code | DE pointer | Spec section |
|------|------------|--------------|
| CDS10001 | varies | per DE — "mandatory data element missing" |
| CDS10020 | 22B / L002 | `de-4-x-valuation.md` (DE 4/1 LocationID) |
| CDS11004 | 02A | `de-2-3-documents.md` |
| CDS12005 / R123 | 57B (`Declarant/ID`, DE 3/18) | `de-3-x-parties.md` — see **R123 investigation** below |
| CDS12005 / R038 | 74A | `de-3-x-parties.md` — rule R038 source pending |
| CDS12056 | 05A | `de-3-x-parties.md` (Agent / Representative — DE 3/19–3/21) |
| CDS12056 | 03A / 226 | DE 2/2 AdditionalInformation — needs Appendix 4 paste |
| CDS12070 | 70A / 166 | `de-1-10-procedures.md` |
| CDS12070 | 39B / 188 | `de-4-x-valuation.md` (ValuationAdjustment) |
| CDS12070 | 03A / 225 / 226 | `de-3-x-parties.md` (DE 2/2 AI `00500` — StatementCode present; paired field missing per relation error) |
| CDS12073 | 67A 103 / 68A 103 | **Resolved FC-MPVNPBLP** — Tag 103 = `TransactionNatureCode` (DE 8/5); fix: render `<TransactionNatureCode>11</TransactionNatureCode>` under `GoodsShipment` (`h1-xml-renderer.ts`) |
| CDS12073 | 57A | `de-3-x-parties.md` (Exporter combination) — superseded by WCOID 103 decode |
| CDS12077 | 23A / 50A / 164 | `de-4-x-valuation.md` (DutyTaxFee) |
| CDS12077 | 92A / 501 | `de-4-x-valuation.md` / Origin |
| CDS12099 | 64A / L016 / L110 / 04A / 410 | `de-5-23-goods-location.md` — invalid combination for DE 5/23 |
| CDS77002 | 02A | `de-2-3-documents.md` (status code missing) |

## Active workstream (2 errors — FC-MPWQSJ97)

**Gate:** One error category per submit. No XML without cited HMRC source. No HMRC SDS. Freeze `passing-payload.xml` on first DMSACC.

| Phase | Scope |
|-------|--------|
| **Done** | CDS12073 — `TransactionNatureCode` renderer fix (FC-MPVNPBLP: 4 → **2** errors) |
| **Done** | CDS12005 investigation — Dev Hub EORIs rejected; cited fix = **Trade Test Data Library EORI** (`spec/hmrc-mirror/cds12005-party-id.md`) |
| **Now** | Switch to TDL EORI `GB553202734852`, Create Test User API with `eoriNumber`, re-OAuth, one submit |

**Lane EORI:** `GB553202734852` per `spec/lane.md` + `spec/hmrc-mirror/trade-test-data-library.md`.

**CDS12073 closed:** DMSREJ Tag **103** = `GoodsShipment/TransactionNatureCode` (not `CountryCode`). Do not revisit Origin / ExportCountry / Destination / GoodsLocation for this code.

### CDS12073 pointer decode (authoritative)

DMSREJ `TagID 103` is the WCO element code **103**, not a generic “country” tag.

| Pointer | WCO path (`cds_wco_references.ts`) | DE | In mapper JSON? | In rendered XML? |
|---------|-----------------------------------|-----|-----------------|------------------|
| `42A` → `67A` / **103** | `GoodsShipment/TransactionNatureCode` | 8/5 | **yes** (`"11"`) | **no** |
| `42A` → `67A` → `68A` / **103** | `GovernmentAgencyGoodsItem/TransactionNatureCode` | 8/5 | **no** (header only) | **no** |

Country fields use other WCOIDs: Destination `465`, Origin `063`, GoodsLocation Address `242`.

ODS CDS12073 text (`src/lib/cds_error_codes.ts`): “8/5 must be declared at least once at either header or item level.”

**Conclusion:** CDS12073 is a **renderer fidelity** problem (DE 8/5 missing from XML HMRC received), not a country-value problem. Do **not** change Origin, ExportCountry, GoodsLocation, Destination, transport, or document codes for this code.

### FC-MPUGJ6M8 submitted XML

| Fact | Result |
|------|--------|
| Request XML stored for LRN `FC-MPUGJ6M8` | **No** (success path does not persist body) |
| Proxy reconstruct (lane + `GBLON004`, same mapper/renderer) | `npx tsx tmp/mapper-xml-fidelity-audit.ts` |
| `<TransactionNatureCode>` in XML sent | **No** (renderer never emits it; git history empty for that tag) |

### 67A `GoodsShipment` — elements in rendered XML (order)

`Consignment` (ContainerCode, ArrivalTransportMeans, GoodsLocation) → `Destination` → `ExportCountry` → `GovernmentAgencyGoodsItem` → `Importer` → `PreviousDocument` → `TradeTerms` → `UCR`.

**Absent vs mapper JSON:** `TransactionNatureCode`, `CurrencyExchange` (mapper has both; renderer drops both).

### 68A `GovernmentAgencyGoodsItem` — direct children in rendered XML (order)

`SequenceNumeric` → `StatisticalValueAmount` → `AdditionalDocument`×2 → `AdditionalInformation` → `Commodity` → `CustomsValuation` → `GovernmentProcedure`×2 → `Origin` → `Packaging` → `ValuationAdjustment` (renderer-only `AdditionCode 0000`).

**Absent vs mapper JSON:** `TransactionNatureCode` (not on item in JSON either).

### JSON → XML fidelity gaps (renderer audit)

| Mapper path | Rendered? | Notes |
|-------------|-----------|-------|
| `GoodsShipment.TransactionNatureCode` | **no** | **CDS12073 / Tag 103** |
| `Declaration.CurrencyExchange` | **no** | Separate DE; not in current DMSREJ set |
| `GoodsShipment.*` (country parties) | yes | Destination, ExportCountry, Origin as today |
| — | **extra XML** | `ValuationAdjustment`, second `DutyTaxFee` B00 not in mapper |

### Out of scope (per project policy)

**Do not** compare 67A/68A structure against archive or “accepted” XML examples — no DMSACC baseline in repo; `test-evidence/archive-pre-p0/` is not acceptance proof.

### Phase 2 candidate (renderer only — not country)

**2026-06-01 renderer fix:** `h1-xml-renderer.ts` emits `<TransactionNatureCode>11</TransactionNatureCode>` immediately after `<GoodsShipment>` (XSD sequence before `Consignment`). Dry-run + `npm run test:h1` pass; `trade-test-cds-v2-request.xml` contains tag. Live runner submit blocked (Convex token fetch timeout) — use app Submit with saved lane.

---

### Phase 1A — CDS12073-relevant fields only (country — closed)

| DE | XML path (actual) | HMRC source | Status | Notes |
|----|-------------------|-------------|--------|-------|
| **3/1** Exporter | `Declaration/Exporter` Name + Address, `CountryCode` **DE** | Appendix 21A: 3/1 **D**, X,Y (`spec/hmrc-mirror/appendix-21a-h1-page.md`); Group 3 [12] conditionality **not pasted** | **pass (presence)** | Not in DMSREJ pointers (`67A`/`68A` Tag 103 only). Foreign Name+Address matches lane `spec/lane.md`. |
| **3/15** Importer | No separate 3/15 name block | Appendix 21A: 3/15 **D**, Y only | **blocked** | Group 3 reading notes [12t][12u] not in spec. |
| **3/16** Importer EORI | `GoodsShipment/Importer/ID` **GB243617410764** | Appendix 21A: 3/16 **D**, Y; ODS CDS12073: “3/15 or 3/16 … at **header** level” (`src/lib/cds_error_codes.ts`) | **pass** | Self-rep: item AI `00500` + `Importer` per `spec/hmrc-mirror/appendix-4a-00500.md`. |
| **5/8** Destination | `GoodsShipment/Destination/CountryCode` **GB** | Group 5 DE 5/8: a2; single item → “declared at **header level only**” (`spec/hmrc-mirror/group-5-completion-guide.md` L48) | **pass** | Matches `spec/lane.md` destination GB. |
| **5/14** Dispatch/export | `GoodsShipment/ExportCountry/ID` **DE** | Group 5 DE 5/14: a2; single item → header only (L87); WCO path `ExportCountry/ID` = DE 5/14 (`convex/lib/cds_wco_references.ts` row 232) | **pass** | Not duplicated at item level. Value DE per lane / Appendix 13 (lane table). |
| **5/15** Origin | `GovernmentAgencyGoodsItem/Origin/CountryCode` **DE** | Group 5 DE 5/15: **NA** header, **1× item** (L106–108); “always mandatory” (L116) | **pass** | Same code as dispatch is allowed (different DEs). |
| **5/23** Location country | `GoodsLocation/Address/CountryCode` **GB** | Group 5 field format country a2 (`spec/de-5-23-goods-location.md`); split shape country **GB** for `GBAUFXTFXTFXT` | **pass** | Distinct from DE 5/8 semantically; both GB. No cite forbids both Tag 103. |
| **8/5** Nature of transaction | Mapper JSON `"11"` at `GoodsShipment`; **absent from XML** | Appendix 21A **A** X,Y; WCOID **103** = `TransactionNatureCode` (`cds_wco_references.ts`) | **fail** | **Active CDS12073 lever** — pointers `67A/103` and `68A/103` are DE 8/5, not country (see above). |

### Phase 1B — Country fields (closed; Tag 103 misread)

Country values all **pass** (table retained for audit trail). DMSREJ Tag **103** is **not** `CountryCode` — see **CDS12073 pointer decode** above (`TransactionNatureCode`, WCOID 103).


---

## Resolution protocol

For each code:

1. Find its DE.
2. Open the spec file for that DE.
3. Verify the spec file cites HMRC for the specific value being submitted.
4. If the cited HMRC content does not match what the submission sent → fix submission to match HMRC.
5. If the cited HMRC content does match → STOP. Do not change XML. Open an HMRC SDS ticket.

## R123 investigation (CDS12005, pointer `42A` → `57B`, TagID `R123`)

**Status:** investigated 2026-06-01. No XML change recommended until a cited rule condition is identified.

### Pointer decode (authoritative)

| Layer | WCOID | XML path | DE | Source |
|-------|-------|----------|-----|--------|
| Declaration | `42A` | `Declaration` | — | `documentation/HMRC/WCO_SECTION_CODES.md` |
| Party | `57B` | `Declaration/Declarant` | 3/17–3/18 | same |
| Field | **`R123`** | `Declaration/Declarant/ID` | **3/18** | `convex/lib/cds_wco_references.ts` sourceRow 117: `wcoId: "R123"`, `wcoPath: "Declaration/Declarant/ID"`, format `an..17` |

**TagID `R123` is the WCO field identifier on `Declarant/ID`, not a separate Tariff Vol 3 “transport rule”.** Same pattern as CDS12073 Tag **103** = `TransactionNatureCode` (not `CountryCode`).

### CDS12005 text (in-repo ODS copy)

From `src/lib/cds_error_codes.ts`:

- **description:** Authorisation Error: Party ID unknown or invalid
- **explanation:** Identification not recognised. An EORI or VAT number included on the declaration is not recognised or the number used is not permitted in this DE.

DMSREJ therefore flags **declarant identification (DE 3/18)** under CDS12005, not a transport element (`15A` / `10A`).

### FC-MPVNPBLP baseline (lane XML — EORI superseded 2026-06-02)

Dry-run artefact `test-evidence/trade-test-cds-v2-request.xml` reflects **prior** EORI `GB243617410764`. **Active lane EORI:** `GB531765313922` (Romwan Lee — `documentation/HMRC/test-user.md`). Re-run dry-run after EORI change.

Historical FC-MPVNPBLP shape (Declarant/Importer were `GB243617410764`):

Dry-run artefact `test-evidence/trade-test-cds-v2-request.xml` (2026-06-01) shows:

| Element | Value | DE |
|---------|-------|-----|
| `Declarant/ID` | `GB243617410764` | 3/18 |
| `GoodsShipment/Importer/ID` | `GB243617410764` | 3/16 |
| `BorderTransportMeans` | `ID` CSCLGLOBE, `IdentificationTypeCode` 11, `ModeCode` 1 | 7/4 / 7/9 |
| `ArrivalTransportMeans` | same triplet (mirrored) | 7/9 |
| Item AI | `00500` + `StatementDescription` Importer | 2/2 (self-rep) |

Local format gate (`src/app/api/hmrc/submit/route.ts`): `^GB\d{12}$` — **pass** for this EORI.

### Hypotheses tested

| Hypothesis | Evidence | Result |
|------------|----------|--------|
| R123 = missing transport triplet (`rule_seed.ts`, `wco-mapper.ts` comments) | FC-MPVNPBLP still has R123 after full BTM+ATM triplets + CDS12073 fix | **Rejected** for current lane |
| R123 = spaces in vessel ID (`stripTransportId` comment) | XML uses `CSCLGLOBE` (no spaces) | **Rejected** for current lane |
| R123 = wrong WCO section (57B = ArrivalTransportMeans) | XSD mapping in `WCO_SECTION_CODES.md`: **57B = Declarant**, **10A** = ArrivalTransportMeans | **Rejected** (stale inference) |
| R123 = declarant EORI not recognised / not permitted in DE 3/18 | CDS12005 ODS text; pointer on `Declarant/ID` only | **Plausible** — condition text for rule id `R123` not in repo |

### Appendix 21A obligation (cited)

`spec/hmrc-mirror/appendix-21a-h1-page.md`: DE **3/18** Declarant identification no — **A** / **Y**. Lane value `GB243617410764` matches `spec/lane.md` and `documentation/HMRC/test-user.md` (sandbox test user EORI).

Group 3 completion guide text for *when* an EORI is “not permitted in this DE” is **not pasted** in `spec/de-3-x-parties.md` — cannot derive a fix from Vol 3 alone.

### Out of scope for R123 (pointer does not include)

- `BorderTransportMeans` (`15A`), `ArrivalTransportMeans` (`10A`)
- `RegistrationNationalityCode` (DE 7/15) — not rendered; would be a separate DE/pointer if required
- `SupervisingOffice` — R038 uses **`74A` = `Importer`**, not supervising office (`convex/lib/cds_wco_references.ts` sourceRow 432)

### Stale in-repo references (do not use for fixes)

- `convex/rule_seed.ts` / `rules-dump.json` — links R123 to transport fields
- `src/lib/wco-mapper.ts` comments on lines 45, 332–334, 386
- `documentation/HMRC/tdr-progress.md` — “R123 / ArrivalTransportMeans”
- `spec/errors-handled.md` row 14 historical note “transport” (pre–WCOID decode)

### Next step (one category)

1. **Create test user** via [Create Test User API](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/api-platform-test-user/1.0): `{ "serviceNames": ["customs-services"], "eoriNumber": "GB553202734852" }` (Customs Declarations API v2.0 — TDL EORI in request).
2. Update `.env.local` `HMRC_EORI`, declaration Declarant + Importer, **re-OAuth** as new user.
3. **One submit** — expect CDS12005 to clear if TDL EORI is the only gap.

Full write-up: `spec/hmrc-mirror/cds12005-party-id.md`.

## R038 — same family as R123

Same CDS12005; pointer `Importer/ID` (DE 3/16). Resolves with the same TDL EORI fix; do not treat separately until R123 path is tested.
