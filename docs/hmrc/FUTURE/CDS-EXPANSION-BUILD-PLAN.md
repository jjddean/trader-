# CDS expansion build plan — B1 export, I1 simplified import, C1 simplified export

**Status:** SUPERSEDED BY ../ACTIVE/tdr/EXPORT-COMPLETION-CHECKLIST.md — B1, C1
and I1 are built; the checklist tracks what remains.  
**Spec:** [`../specs/cds-api/declaration-categories-index.md`](../specs/cds-api/declaration-categories-index.md)  
**Backlog:** [`../ACTIVE/tdr/BACKLOG.md`](../ACTIVE/tdr/BACKLOG.md)  
**Last updated:** 2026-06-20

---

## Three things to build

| # | Build | CDS category | Spec appendix |
|---|-------|--------------|---------------|
| 1 | Standard **export** | B1 | 22A |
| 2 | **Simplified import** (frontier + supplementary) | I1 C&F → H* | 21F → 21A |
| 3 | **Simplified export** (frontier + supplementary) | C1 C&F → B1 | 22D → 22A |

Same API as H1 today: `POST /customs/declarations/`. Category = DE 1/1 + DE 1/2 in XML.

**Not in this plan:** C21 inventory, SPIMM, BIRDS, H7, stand-alone EXS-only.

---

## Starting point

Today: **H1 import only** — `mapToCDS_H1`, Appendix 21A mirrored, import UI.

Need: Appendix **21F/G**, **22A/D/E** mirrored; export UI; supplementary parent/child declarations; category-aware mapper.

---

## Step 0 — Shared refactor (once)

| Task | Where |
|------|--------|
| Mirror obligation tables | `docs/hmrc/specs/cds-api/appendix-21f-*.md`, `appendix-22*.md` |
| Category on schema | `declarations.declarationCategory`, `route` import/export |
| Supplementary link | `parentDeclarationId` on child declarations |
| Split mapper | `mapToCDS({ category, … })` → h1 / b1 / i1 / c1 modules |
| Generalise XML renderer | `cds-xml-renderer.ts` or dispatch from category |
| Category rule packs | `rule_definitions` / seed per appendix |
| Fixtures + tests | `test-evidence/fixtures/cds/{b1,i1,c1}/`, `test:cds-categories` |

---

## 1 — B1 standard export (implementation-ready design)

### 1.1 Objective

Build the first export category as a real, testable CDS flow that matches the existing H1 import baseline but is category-aware for export declarations.

At implementation time, B1 is not a variant of H1; it is a separate declaration category with:

- export route in the declaration model
- `declarationCategory = "B1"`
- export-only completion-rule sets and validation gates
- Appendix 22A field obligations rather than Appendix 21A import obligations
- export-specific party and location logic
- export document codes and multi-item handling
- existing HMRC submit/amend/cancel routes reused, but category-specific XML generation

This section is the engineering contract for B1. It is intentionally more concrete than the earlier roadmap and is the basis for design, implementation, and acceptance tests.

### 1.2 Source of truth and implementation boundary

Authoritative HMRC data source:

- Appendix 22A (B1 export / re-export standard declaration)
- CDS Export completion groups 1–8
- Current in-repo pattern: `src/lib/wco-mapper.ts`, `src/lib/h1-xml-renderer.ts`, `convex/schema.ts`, `convex/rule_seed.ts`

Implementation rule:

- Do not implement B1 from assumptions.
- Mirror Appendix 22A into `docs/hmrc/specs/cds-api/appendix-22a-b1-obligations.md` before production acceptance.
- Use the same rule-engine pattern as H1: validation belongs in `rule_definitions`/`rule_seed.ts`, not hardcoded in the mapper.
- The mapper split must be category-aware, not a branching hack inside the import pathway.

### 1.3 Category contract

For B1:

- Direction: export
- Declaration category: `B1`
- XML category encoding: DE 1/1 + DE 1/2 in the same way as H1, using the export-type selector and the correct category set
- Function code: same HMRC route contract as current submit flow
- Type code: export variant via existing `mapDeclarationType()` pattern (`EXA`, `EXB`, etc.) and not hardcoded to the import `IM*` branch
- Supplementary flow: this is not part of Phase 1; B1 standard declaration is the foundation for later C1 and supplementary export declarations

### 1.4 Data model additions (required schema fields)

The B1 implementation must add or normalise these declaration fields in `convex/schema.ts` and in the declaration create/edit UI.

| Area | Field(s) | Purpose |
|------|----------|---------|
| Route/category | `route`, `declarationCategory`, `declarationType` | Distinguish export and category-specific dispatch logic |
| Header / identity | `lrn`, `eori`, `presentationOffice` | HMRC header + declarant / office linkage |
| Geography | `dispatchCountry`, `destinationCountry`, `originCountry` | Export dispatch and destination / customs-country logic |
| Parties | `exporterEori`, `exporterName`, `exporterLine`, `exporterCity`, `exporterPostcode`, `importerEori`, `representativeEori`, `representationType` | Exporter/representative/data rules |
| Valuation | `invoiceCurrency`, `invoiceTotal`, `incoterms`, `incotermLocation`, `valuationAdditionCode` | Trade terms and customs value logic |
| Goods location | `goodsLocationKind`, `goodsLocationTypeCode`, `goodsLocationQualifier`, `locationId` | DE 5/23 and export location mapping |
| Delivery | `transportMode`, `transportId`, `transportIdType`, `borderOffice`, `officeOfExit` | Border transport fields and routes |
| Commodity | `commodityCode`, `description`, `grossWeightKg`, `netWeightKg`, `packageCount`, `preferenceCode`, `supplementaryUnitQty` | Goods item essentials |
| Documents | `additionalDocuments[]`, `documentCode`, `licenceNumber`, `authorisationType`, `authorisationReference`, `previousDocument` | Export document + licensing rules |
| Payment | `paymentMethodCode`, `defermentAccountNumber` | Financial obligation mapping |
| Business | `clientId`, `orgId`, `workspaceId`, `mode` | Existing app/account context |

Required B1 item fields:

- `commodityCode`
- `description`
- `grossWeightKg`
- `netWeightKg`
- `packageCount`
- `invoiceCurrency` (or declaration-level fallback)
- `valueAmount`
- `preferenceCode`
- `procedureCode`
- `countryOfOrigin`
- `additionalDocuments[]`
- `supplementaryUnitQty` (conditional)

### 1.5 B1 UI field specification

The B1 create/edit form must be split into the same group structure as the export completion guide, not a single flat form. The field set is a mandatory design contract.

#### 1.5.1 Group 1 — declaration header

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `route` | select | yes | Must resolve to `export` |
| `declarationCategory` | select | yes | Default `B1` |
| `declarationType` | select | yes | `EXA`/`EXB`/`EXC` etc. as applicable |
| `lrn` | text | yes | Generated unless supplied |
| `eori` | text | yes | Declarant EORI |
| `presentationOffice` | select | yes | Office of presentation/exit linkage |
| `mode` | select | no | `minimal`/`enriched` |

#### 1.5.2 Group 2 — parties and representation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `exporterEori` | text | conditional | Required when dispatch country is GB/XI and exporter is an EORI party |
| `exporterName` | text | conditional | Required when overseas exporter is used |
| `exporterAddressLine` | text | conditional | Must be captured when exporter EORI unavailable and dispatch country is not GB/XI |
| `exporterCity` | text | conditional | Required with overseas exporter block |
| `exporterPostcode` | text | conditional | Required with overseas exporter block |
| `importerEori` | text | conditional | Existing model field; must be validated for export scenarios |
| `representativeType` | select | conditional | self/direct/indirect |
| `representativeEori` | text | conditional | Only when representation is not self |
| `representativeName` | text | conditional | Only when direct/indirect representation |

#### 1.5.3 Group 3 — locations and routes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `dispatchCountry` | select | yes | Where the goods are exported from; normally GB/XI or an overseas origin context |
| `destinationCountry` | select | yes | Final destination country |
| `originCountry` | select | yes | Country of origin / origin declaration |
| `goodsLocationKind` | select | yes | `port` / `address` / `unlocode` |
| `goodsLocationTypeCode` | select | conditional | Derived from `resolveGoodsLocationForXml()` |
| `goodsLocationQualifier` | select | conditional | Determined by goods-location resolution logic |
| `locationId` | text | conditional | Must match HMRC location-code rules |

#### 1.5.4 Group 4 — valuation and taxes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `incoterms` | select | conditional | Required for export declarations in standard route flow |
| `incotermLocation` | text | conditional | Required/conditional depending on term and country |
| `invoiceCurrency` | select | yes | Standard declaration currency |
| `invoiceTotal` | number | yes | Required for customs value checks |
| `valuationAdditionCode` | text | no | Only when compatible with Incoterm |
| `paymentMethodCode` | select | conditional | Typically deferment or cash route |
| `defermentAccountNumber` | text | conditional | Only when used |

#### 1.5.5 Group 5 — goods item details

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `commodityCode` | text | yes | 8/10-digit HS code |
| `description` | text | yes | Commodity description |
| `grossWeightKg` | number | yes | Must be > 0 |
| `netWeightKg` | number | conditional | Required/validated against gross |
| `packageCount` | number | yes | Total packages per item |
| `countryOfOrigin` | select | yes | Country of origin |
| `preferenceCode` | select | conditional | Duty preference / regime |
| `procedureCode` | text | yes | CPC / procedure-specific gate |
| `supplementaryUnitQty` | number | conditional | Required for listed commodities |

#### 1.5.6 Group 6 — document and licence handling

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `additionalDocuments[]` | array/object | conditional | Document list per item or header |
| `documentCode` | select | conditional | Export-doc code selection |
| `documentReference` | text | conditional | Item or header reference |
| `documentStatusCode` | select | conditional | Standard status flow |
| `licenceNumber` | text | conditional | Export licence or authorisation reference |
| `authorisationType` | select | conditional | Authorisation code and category |
| `authorisationReference` | text | conditional | Required with specific authorisations |

#### 1.5.7 Group 7 — transport and border movement

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `transportMode` | select | yes | Border mode of transport |
| `transportId` | text | yes | Vessel / vehicle / flight identifier |
| `transportIdType` | select | yes | Type code for identifier |
| `officeOfExit` | select | conditional | Export office / exit location, as applicable |
| `borderOffice` | select | conditional | Border office if required by route |

### 1.6 XML mapping design (B1)

B1 XML generation must be produced by a category-specific mapper, not by reusing the H1 import map.

Implementation target:

- `mapToCDS_B1(...)` in the mapper module family
- dispatch from a category-aware selector such as `mapToCDS({ category, declaration, items, ... })`
- shared helpers remain, but export-specific mapping must be isolated

#### 1.6.1 Mandatory WCO / DE mapping pattern

| DE / area | B1 requirement | Mapper target |
|-----------|----------------|---------------|
| DE 1/1 + 1/2 | declaration category / additional type | `Declaration.TypeCode` + category logic |
| DE 3/1 | exporter party | `Exporter` or `Exporter.Address` block |
| DE 3/2 | declarant | `Declarant.ID` |
| DE 3/4 / 3/5 | representation | `Representative` block |
| DE 4/1 | trade terms | `GoodsShipment.TradeTerms.ConditionCode` |
| DE 4/8 | payment method | `AdditionalDocument` / finance block |
| DE 5/23 | goods location | `GoodsLocation` resolution in `resolveGoodsLocationForXml()` |
| DE 5/14 / 5/8 | countries / routing | dispatch/destination logic |
| DE 7/4 + 7/7 + 7/9 | border transport | `BorderTransportMeans`, `ArrivalTransportMeans` |
| DE 8/5 | nature of transaction | `GoodsShipment.TransactionNatureCode` |
| DE 2/1 | previous document | `PreviousDocument` |
| DE 2/3 | additional documents | `AdditionalDocument` on `GovernmentAgencyGoodsItem` |
| DE 6/1 + 6/5 | mass | `GoodsMeasure.GrossMassMeasure` / `NetNetWeightMeasure` |
| DE 6/2 | supplementary quantity | conditional package-measure field |

#### 1.6.2 Core XML rules to preserve

The B1 implementation must preserve the core invariants already established in the import baseline:

- `xmlEscape()` on every interpolated XML value
- no empty strings for code-list values when the schema expects omission
- no silent defaulting where HMRC requires a field or block
- `route === "export"` must produce export `TypeCode` and export location logic
- `Declaration.FunctionCode` remains in HMRC submit workflow contract
- `DeclarationOfficeID`, `PresentationOffice`, and export border/location fields are validated before submit

#### 1.6.3 B1-specific mapping requirements

The export mapper must explicitly handle:

- outbound dispatch country vs final destination country
- export agent / rep / declarant party roles distinct from import roles
- export location logic (`goodsLocationKind`, `goodsLocationTypeCode`, `goodsLocationQualifier`)
- `ExportCountry.ID` and `Destination.CountryCode` not conflated with import equivalent logic
- `PreviousDocument` and document codes required for export compliance
- `TransactionNatureCode` as an explicit required value on the declaration
- export document and authorisation references to be emitted only when present and valid

### 1.7 Validation matrix

The B1 validation matrix must be implemented through the rule engine (`convex/rule_seed.ts` + rule definitions) and not hidden inside the fragment builder.

| Rule family | Required conditions | Fail mode |
|-------------|--------------------|-----------|
| Declaration header | route=export, category=B1, declarationType present | blocking validation |
| Party rules | exporter/declarant/representative role consistency | blocking validation |
| Geography | valid dispatch country, destination country, origin country linkage | blocking validation |
| Location rules | valid export goods location code/qualifier | blocking validation |
| Trade terms | incoterms + compatible location code logic | blocking validation |
| Commodity | commodity code present, description present, weight > 0 | blocking validation |
| Packaging | package count > 0, net mass <= gross mass | blocking validation |
| Transport | valid mode, ID, ID type | blocking validation |
| Documents | valid export document codes and status codes | conditional blocking |
| Licences | authorisation type + reference pair valid | conditional blocking |
| Value | invoice value present and valid currency | blocking validation |

Required validation checkpoints:

- route/export category gate
- goods location resolution before XML build
- invalid exporter address block guard
- `transactionNatureCode` mandatory
- `incoterms` / `incotermLocation` compatibility check
- `goodsLocationTypeCode` and `goodsLocationQualifier` must resolve to a valid HMRC mapping
- document-code list must be constrained to valid export Appendix 5A/22 rules
- export-only procedures must not be allowed under import category logic

### 1.8 Export location rules

Re-use the existing `resolveGoodsLocationForXml()` pattern but add export-specific constraints.

The B1 implementation must enforce:

- `goodsLocationKind` is normalised before XML generation
- `goodsLocationTypeCode` and qualifier are not free text unless accepted by the HMRC code list
- `locationId` must be omitted when blank, not emitted as an empty string
- export location logic must distinguish border office, port, and address-based goods-location types
- when location is a port/unlocode, the XML must resolve to the canonical form used by the HMRC export mapping rules
- all export goods-location values must be validated against the correct Appendix 16C/16I logic and not re-used from import logic without checks

The final rule is explicit:

- export declarations use export-oriented location resolution and not the import-only `resolveGoodsLocationForXml()` defaults unless the logic is proven equivalent for B1

### 1.9 Parties and representation rules

B1 must treat parties differently from import declarations.

Required party logic:

- Declarant is the filing party (`Declarant.ID`)
- Exporter may be represented by EORI or by a full overseas exporter address block
- Use exporter EORI only when dispatch country is GB/XI and the exporter is a UK/XI party
- If dispatch country is not GB/XI and the exporter is not a GB/XI EORI, require a full foreign exporter block with name + address + postcode + city
- Representative block is included only when representation is not self
- `importerEori` must not silently substitute for exporter if the transaction is an export declaration

### 1.10 Transport field rules

The export transport block must be category-aware and mirror the current `BorderTransportMeans` / `ArrivalTransportMeans` pattern already used in H1.

Required rules:

- `transportMode` must be populated before XML generation
- `transportId` must be stripped of whitespace before emission
- `transportIdType` must match the selected transport mode and valid HMRC code list
- export declarations must not allow an empty or placeholder transport ID that passes UI validation but fails HMRC schema validation
- `BorderTransportMeans` and `ArrivalTransportMeans` must match in identity and type, as the current import logic already enforces

### 1.11 Licence and document handling

This is a mandatory part of B1, not optional enrichment.

Required handling:

- `documentCode` and `documentReference` must be emitted only if valid for the selected export declaration route
- item-level documents are allowed for export declarations when the route and category permit them
- header-level `AdditionalDocument` is allowed only for the permitted export document set
- `licenceNumber` and `authorisationReference` must be paired with the correct authorisation type
- export document status handling must default safely, never assume a missing document status is valid if the Appendix requires one
- `forbiddenDocCodes` handling must be retained for HMRC rejection prevention

Implementation requirement:

- A `validateExportDocumentSet()` helper should be introduced in the same software layer as the current H1 validators, and called before XML generation

### 1.12 Multi-item support and export-doc treatment

B1 sits on top of the current multi-item declaration pipeline, but export behaviour must be enforced at item level.

Required:

- `GoodsItemQuantity` must match the actual item count
- each item must carry its own commodity and package data
- item-level document codes must be filtered by appendix rules
- no document code may be emitted if it is forbidden by the selected export flow
- total mass and values must be aggregated correctly before XML submit

### 1.13 Fixture strategy and test data

Create new fixtures under `test-evidence/fixtures/cds/b1/` and ensure the implementation test suite explicitly exercises all B1 variants.

Required fixture set:

- minimal valid B1 declaration
- B1 with overseas exporter address block
- B1 with UK/XI exporter EORI
- B1 with representative direct/indirect party
- B1 with transport mode road / sea / air
- B1 with package-only item
- B1 with multi-item declaration
- B1 with additional export documents
- B1 with invalid location code to confirm rejection handling
- B1 with invalid transaction nature code and export-country mismatch

Each fixture should include:

- declaration JSON
- item JSON
- expected WCO output summary
- expected validation errors (if any)
- expected HMRC rejection category if relevant

### 1.14 Staged acceptance criteria

#### Stage A — B1 declaration model and route

Acceptance:

- `route === "export"` is supported in declaration schema and UI
- `declarationCategory = "B1"` is persisted
- B1 declarations are distinct from H1 import declarations
- create/edit UI loads export fields correctly

#### Stage B — B1 mapper and XML output

Acceptance:

- `mapToCDS_B1` generates valid WCO payload structure for a minimal export declaration
- export `TypeCode` is produced correctly
- goods location, destination, dispatch, and transport blocks are emitted in the correct schema order
- no H1 import fields leak into export XML
- `xmlEscape()` is called for all XML values

#### Stage C — validation layer

Acceptance:

- export validation runs through rule definitions before submission
- missing `transactionNatureCode`, invalid goods location, and exporter block mismatch are rejected before MDF/HMRC call
- invalid document or transport combinations are blocked
- H1 import-only validation rules do not apply to B1 without explicit category qualification

#### Stage D — end-to-end submit path

Acceptance:

- B1 declaration can be submitted through the existing HMRC route
- amend and cancel flows reuse the same API wrappers
- `X-Conversation-ID` logging and HMRC fallback logic remain intact
- no breakage to existing H1 import regression flow

#### Stage E — regression protection

Acceptance:

- `npm run test:tdr` remains green
- H1 import regression tests continue to pass
- B1 tests are added and run in a dedicated category suite
- B1 examples are retained in `test-evidence/fixtures/cds/b1/`

### 1.15 Implementation order for B1

1. Mirror Appendix 22A and completion groups into repo documentation
2. Extend `convex/schema.ts` with export-specific B1 fields
3. Add `declarationCategory` and route-aware defaults in declarations CRUD
4. Add B1 rule definitions to `rule_seed.ts`
5. Split mapper into category-aware module(s) and implement `mapToCDS_B1`
6. Add export create/edit UI and declaration type selector logic
7. Implement export document and licence validation
8. Implement multi-item export aggregation and test fixtures
9. Run B1 fixture + regression suite and fix any failing category gates
10. Lock the category contract before moving to C1 or supplementary export work

### 1.16 Definition of done for B1

B1 is considered ready for engineering sign-off only when all of the following are true:

- Appendix 22A mirror exists and is reviewed
- field inventory is complete and version-controlled
- XML mapping is defined and tested
- validation matrix is seeded in rule definitions
- export location rules are proven
- parties, transport, and documents are covered by tests
- create/edit export UI is implemented and tested
- H1 import regression remains green
- sample fixtures cover success and failure paths

This is the required build envelope for B1 export. It should be treated as the minimum implementation contract before coding begins.

---

## 2 — I1 simplified import (implementation-ready design)

### 2.1 Objective

Build the first simplified import category as a distinct declaration flow and not as a hidden variant of H1. I1 is a reduced import declaration category with a different declaration type code combination and a different rule set than H1.

This work must support:

- frontier I1 regular-use simplified import (`DE 1/2 = C + F`)
- occasional use I1 B&E as a later variant
- later supplementary import declarations derived from accepted I1 declarations
- category guard logic to reject I1 when the procedure code requires full H1 import data

The phase-1 contract is: `route = "import"`, `declarationCategory = "I1"`, `TypeCode` selected from the import simplified category set, and the declaration must pass the Appendix 21F obligation rules.

### 2.2 Source of truth and implementation boundary

Authoritative data sources:

- Appendix 21F (I1 C&F) regular-use simplified import
- Appendix 21G (I1 B&E) occasional simplified import
- Appendix 24 (FSD) later import supplementary obligations
- HMRC CDS completion notes for the selected procedure code

Implementation rule:

- Never treat I1 as “H1 with fields hidden”.
- Mirror each Appendix 21F/21G field set before production acceptance.
- Keep the validation pack in `rule_seed.ts` and rule definitions.
- The mapper must be category-aware and not a single import branch that toggles some fields.

### 2.3 Category contract

For I1:

- Direction: import
- Declaration category: `I1`
- XML additional declaration type: `DE 1/2 = C + F` for regular I1, `B + E` for occasional I1
- `Declaration.TypeCode` is the import simplified type, not standard H1 import `IMA` / `IMB` type codes
- CPC guard: if the selected procedure code requires H1 per Appendix 1 completion notes, block I1 and force H1
- Supplementary import declarations use full H1-style data sets after the I1 acceptance, not a reduced form

### 2.4 Data model additions for I1

The I1 implementation reuses a significant part of the existing import declaration base but must add or normalise the following fields:

| Area | Field(s) | Purpose |
|------|----------|---------|
| Route/category | `route`, `declarationCategory`, `declarationType` | Distinguish import simplified flow |
| Header | `lrn`, `eori`, `presentationOffice` | HMRC header and office linkage |
| Geography | `originCountry`, `dispatchCountry`, `destinationCountry` | Import-country routing and goods location |
| Parties | `importerEori`, `declarantEori`, `representativeType`, `representativeEori` | Simplified import representation |
| Goods location | `goodsLocationKind`, `goodsLocationTypeCode`, `goodsLocationQualifier`, `locationId` | Required for import simplified declarations |
| Valuation | `invoiceCurrency`, `invoiceTotal`, `incoterms` | Customs value and movement metadata |
| Transport | `transportMode`, `transportId`, `transportIdType`, `arrivalOffice` | Border movement and arrival data |
| Commodity | `commodityCode`, `description`, `grossWeightKg`, `netWeightKg`, `packageCount`, `countryOfOrigin`, `procedureCode` | Core item facts |
| Documents | `previousDocument`, `additionalDocuments[]`, `documentCode`, `documentReference` | I1 and later supplementary document chain |
| Customs | `cpc`, `authorisationType`, `authorisationReference` | Simplified import authorisation and procedure logic |

### 2.5 I1 UI field specification

The I1 form should be a reduced import form that avoids adding full H1 import fields by default.

#### 2.5.1 Group 1 — declaration header

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `route` | select | yes | Must resolve to `import` |
| `declarationCategory` | select | yes | Default `I1` |
| `declarationType` | select | yes | Simplified import type, e.g. `C+F` or `B+E` family |
| `lrn` | text | yes | Generated unless entered |
| `eori` | text | yes | Declarant/importer EORI |
| `presentationOffice` | select | conditional | Required by route and procedure |

#### 2.5.2 Group 2 — parties and representation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `importerEori` | text | yes | Main importer for import declaration |
| `representativeType` | select | conditional | self/direct/indirect |
| `representativeEori` | text | conditional | Only when not self |
| `representativeName` | text | conditional | For representation when required |

#### 2.5.3 Group 3 — locations and valuation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `originCountry` | select | yes | Country of origin |
| `destinationCountry` | select | yes | Country of destination |
| `dispatchCountry` | select | conditional | Used for import flow context|
| `goodsLocationKind` | select | yes | `port` / `address` / `unlocode` |
| `goodsLocationTypeCode` | select | conditional | Derived by goods-location helper |
| `goodsLocationQualifier` | select | conditional | Validation-aware |
| `locationId` | text | conditional | Must pass HMRC code-list validation |
| `invoiceCurrency` | select | yes | Invoice currency |
| `invoiceTotal` | number | yes | Required value gate |

#### 2.5.4 Group 4 — goods item and procedure

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `commodityCode` | text | yes | HS code |
| `description` | text | yes | Commodity description |
| `grossWeightKg` | number | yes | Must be > 0 |
| `netWeightKg` | number | conditional | Must not exceed gross |
| `packageCount` | number | yes | Package count per item |
| `countryOfOrigin` | select | yes | Key import flow field |
| `procedureCode` | text | yes | CPC / procedure code |
| `cpc` | text | conditional | Additional procedure context |
| `supplementaryUnitQty` | number | conditional | Only if required by commodity |

#### 2.5.5 Group 5 — transport and documents

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `transportMode` | select | yes | Border mode |
| `transportId` | text | yes | Vehicle / vessel / flight ID |
| `transportIdType` | select | yes | Type code for transport ID |
| `documentCode` | select | conditional | Reduced list of allowed docs |
| `documentReference` | text | conditional | Document reference |
| `previousDocument` | object/array | conditional | For supplementary chain or prior declaration links |

### 2.6 XML mapping design (I1)

I1 XML generation must be direct and category-aware, with separate logic from H1.

Implementation target:

- `mapToCDS_I1(...)`
- category dispatch in a unified mapper or dedicated module family
- reuse current helpers only where the logic is explicitly valid for I1

#### 2.6.1 Mandatory mapping pattern

| DE / area | I1 requirement | Mapper target |
|-----------|----------------|---------------|
| DE 1/1 + 1/2 | simplified import category code | category-specific `TypeCode`/category handling |
| DE 3/1 / 3/2 | importer/declarant roles | `Importer` and `Declarant` blocks |
| DE 4/1 | trade terms / valuation | `TradeTerms` / `Value` fields |
| DE 5/23 | goods location | `GoodsLocation` resolution |
| DE 5/8 / 5/14 | country routing | import flow mapping |
| DE 7/4 / 7/7 / 7/9 | border transport | `BorderTransportMeans` + `ArrivalTransportMeans` |
| DE 2/1 | previous documents | previous declaration / MRN linkage |
| DE 6/1 / 6/5 | weight and measure | gross/net measure mapping |

#### 2.6.2 I1-specific requirements

- Use the simplified import declaration category rather than standard H1 `TypeCode` values
- Apply the CPC guard before XML generation
- Only emit fields that are valid under Appendix 21F / 21G for the chosen I1 variant
- Do not silently include H1-only fields just because they exist in the model
- For supplementary import declarations, prefill from the accepted I1 and add the full H1 remainder only where required

### 2.7 Validation matrix

| Rule family | Required conditions | Fail mode |
|-------------|--------------------|-----------|
| Category gate | `route=import`, `declarationCategory=I1` | blocking validation |
| Procedure code | CPC must allow I1; otherwise force H1 | blocking validation |
| Goods location | valid import goods location and location code | blocking validation |
| Country linkage | destination / origin / dispatch must match import flow | blocking validation |
| Transport | valid mode / ID / type | blocking validation |
| Value | invoice value and currency present | blocking validation |
| Goods | commodity code, weight, package count present | blocking validation |
| Document chain | previous docs / MRN link valid for supplementary flows | conditional blocking |

Required validation checkpoints:

- CPC guard before mapper call
- no H1-only fields emitted in I1 route without explicit override
- item-level weight checks and net<=gross validation
- reduced-form document list validation
- previous-document category and MRN rules for supplementary flows

### 2.8 Supplementary import flow requirements

The first simplified import implementation is only the frontier I1 flow. The follow-on supplementary flow must be designed, but not mixed into the first phase.

Requirements for supplementary import:

- create from accepted I1 declaration
- prefill the accepted I1 data into the supplementary declaration
- fill the remaining H1-required fields only when Appendix 21 rules require them
- `DE 2/1 previous document` must reference the I1 MRN (category Y by the XML contract)
- `Accept Date` is included in the XML schema for the supplementary flow per HMRC rules
- supplementary import is not a reduced-form declaration; it is a full H1 remainder set layered over the previous I1 context

### 2.9 Test fixtures and staged acceptance

Required fixture set:

- minimal valid I1 C&F declaration
- I1 with CPC that requires H1 (must fail)
- I1 with valid goods location
- I1 with invalid transport data
- I1 with valid multi-item flow
- accepted I1 → supplementary import draft
- I1 B&E variant

Stage acceptance:

- Stage A: route/category and declarations form
- Stage B: mapper emits correct I1 XML
- Stage C: CPC + document + location validation gates pass
- Stage D: accepted I1 can be used to create a supplementary import declaration
- Stage E: H1 regression tests remain green

### 2.10 Implementation order for I1

1. Mirror Appendix 21F + 21G into repo docs
2. Add I1 category fields and route-aware defaults to `convex/schema.ts`
3. Add I1 rule definitions and CPC guard logic to `rule_seed.ts`
4. Implement `mapToCDS_I1`
5. Build reduced import UI and declaration-type selector
6. Validate simplified-import document and location handling
7. Add accepted-I1 → supplementary draft flow
8. Run I1 fixture tests and regression suite

This remains a defined, staged implementation, not a hidden branch of H1.

---

## 3 — C1 simplified export (implementation-ready design)

### 3.1 Objective

Build the simplified export category as a separate export flow that depends on the B1 export baseline but is materially reduced in the same way Appendix 22D differs from 22A.

This work must cover:

- frontier C1 regular-use simplified export (`DE 1/2 = C + F`)
- later C1 B&E occasional variant
- supplementary export declarations built on accepted C1 and mapped to B1
- reduced-form export handling while preserving the required EXS/combined-data rules where applicable

### 3.2 Source of truth and implementation boundary

Authoritative data sources:

- Appendix 22D (C1 C&F regular-use simplified export)
- Appendix 22E (C1 B&E occasional simplified export)
- Appendix 22A (B1 supplementary export declaration)
- Export completion groups 1–8

Implementation rule:

- C1 depends on B1 infrastructure and should not be started before B1 is in place.
- Reduced form is allowed only where Appendix 22D/22E specifically permit it.
- Where EXS or combined data is required, the export path must include the correct B1-style fields and not skip them by accident.

### 3.3 Category contract

For C1:

- Direction: export
- Declaration category: `C1`
- XML category: `DE 1/2 = C + F` for regular use; `B + E` for occasional use
- Functions as a simplified export route, but the declaration can still carry EXS/combined-set elements when required by the prevailing export flow
- Supplementary export declarations are B1-based and are created from accepted C1 declarations
- `mapToCDS_C1` is required, but the supplementary flow uses B1 as the declaration-family parent

### 3.4 Data model additions for C1

C1 reuses the B1 export data model but with reduced-form controls and reduced-document requirements.

| Area | Field(s) | Purpose |
|------|----------|---------|
| Route/category | `route`, `declarationCategory`, `declarationType` | Distinguish simplified export flow |
| Header | `lrn`, `eori`, `presentationOffice`, `officeOfExit` | Export declaration routing |
| Geography | `dispatchCountry`, `destinationCountry`, `originCountry` | Export flow and destination matching |
| Parties | `exporterEori`, `exporterName`, `exporterLine`, `exporterCity`, `exporterPostcode`, `representativeType` | Reduced export-party rules |
| Goods location | `goodsLocationKind`, `goodsLocationTypeCode`, `goodsLocationQualifier`, `locationId` | Validated for export |
| Valuation | `invoiceCurrency`, `invoiceTotal`, `incoterms`, `incotermLocation` | Export value and trade terms |
| Transport | `transportMode`, `transportId`, `transportIdType`, `officeOfExit` | Border movement |
| Commodity | `commodityCode`, `description`, `grossWeightKg`, `netWeightKg`, `packageCount`, `countryOfOrigin`, `procedureCode` | Core export item data |
| Documents | `additionalDocuments[]`, `documentCode`, `documentReference`, `licenceNumber`, `authorisationType` | Reduced export docs and authorisations |

### 3.5 C1 UI field specification

The C1 form is a reduced export form that sits on the B1 export foundation.

#### 3.5.1 Group 1 — declaration header

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `route` | select | yes | Must resolve to `export` |
| `declarationCategory` | select | yes | Default `C1` |
| `declarationType` | select | yes | Simplified export variant |
| `lrn` | text | yes | Generated unless entered |
| `eori` | text | yes | Declarant EORI |
| `presentationOffice` | select | conditional | Office linkage |

#### 3.5.2 Group 2 — parties and representation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `exporterEori` | text | conditional | UK/XI exporter EORI when applicable |
| `exporterName` | text | conditional | Required for overseas exporter block |
| `exporterAddressLine` | text | conditional | For overseas exporter when disallowed EORI |
| `exporterCity` | text | conditional | Required with overseas exporter block |
| `exporterPostcode` | text | conditional | Required with overseas exporter block |
| `representativeType` | select | conditional | self/direct/indirect |
| `representativeEori` | text | conditional | Non-self representation |

#### 3.5.3 Group 3 — locations and trade terms

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `dispatchCountry` | select | yes | UK/XI or departure location |
| `destinationCountry` | select | yes | Final destination |
| `originCountry` | select | yes | Country of origin |
| `goodsLocationKind` | select | yes | location type |
| `goodsLocationTypeCode` | select | conditional | export location code |
| `goodsLocationQualifier` | select | conditional | location qualifier |
| `locationId` | text | conditional | validated location code |
| `incoterms` | select | conditional | export trade terms |
| `incotermLocation` | text | conditional | term-specific location |

#### 3.5.4 Group 4 — goods and transport

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `commodityCode` | text | yes | HS code |
| `description` | text | yes | Goods description |
| `grossWeightKg` | number | yes | > 0 |
| `netWeightKg` | number | conditional | Must not exceed gross |
| `packageCount` | number | yes | package count |
| `countryOfOrigin` | select | yes | origin country |
| `procedureCode` | text | yes | export procedure / CPC |
| `transportMode` | select | yes | border mode |
| `transportId` | text | yes | transport identifier |
| `transportIdType` | select | yes | type code |

#### 3.5.5 Group 5 — document and authorisation set

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `documentCode` | select | conditional | only valid simplified export docs |
| `documentReference` | text | conditional | export doc ref |
| `licenceNumber` | text | conditional | when applicable |
| `authorisationType` | select | conditional | valid export authorisation |
| `authorisationReference` | text | conditional | required with authorisation |

### 3.6 XML mapping design (C1)

C1 must be mapped by `mapToCDS_C1` and use the export baseline created by the B1 implementation.

Key requirements:

- use export declaration category but reduced-form data set per Appendix 22D / 22E
- omit or suppress fields that are disallowed by simplified export rules
- still retain the B1-level fields when a combined or EXS-carrying export declaration requires them
- keep `xmlEscape()` and schema ordering intact
- allow `PreviousDocument` link for supplementary declaration flows only when the C1 accepted declaration is being used as a source document

### 3.7 Validation matrix

| Rule family | Required conditions | Fail mode |
|-------------|--------------------|-----------|
| Category gate | `route=export`, `declarationCategory=C1` | blocking validation |
| Declaration type | valid simplified export type | blocking validation |
| Exporter rules | EORI vs overseas exporter block validated | blocking validation |
| C1 reduced set | only reduced-set fields passed | blocking validation |
| Location | valid export goods location | blocking validation |
| Trade terms | incoterms compatible with country and route | blocking validation |
| Goods values | package count, weight, value present | blocking validation |
| Transport | valid mode/ID/type | blocking validation |
|Documents | valid C1 export codes + authorisation set | conditional blocking |

### 3.8 Supplementary export flow requirements

C1 is not the final export category. It is the source for supplementary export declarations.

Required logic:

- accepted C1 declaration can create supplementary export declaration
- supplementary export declaration is B1-based
- `PreviousDocument` / MRN chain must reference the accepted C1 MRN as required by the XML rules
- EXS-related data that was already supplied in the C1 pre-departure declaration may be omitted from supplementary B1 where Appendix 22 permits it
- the supplementary declaration must not reinsert reduced-form C1 fields where the B1 data set requires the full export structure

### 3.9 Test fixtures and acceptance

Required fixture set:

- minimal valid C1 C&F declaration
- C1 with overseas exporter block
- C1 with UK/XI exporter EORI
- C1 with invalid location code
- C1 with reduced docs subset
- C1 with accepted declaration used to create a supplementary B1 draft
- C1 B&E variant

Acceptance criteria:

- Stage A: C1 route/category and UI flow
- Stage B: `mapToCDS_C1` emits valid simplified export XML
- Stage C: reduced-form validation is enforced and not accidentally mapped to B1 rules
- Stage D: accepted C1 can produce a valid B1 supplementary declaration
- Stage E: B1 and H1 regression tests remain green

### 3.10 Implementation order for C1

1. Complete B1 export baseline and document/validation contract
2. Mirror Appendix 22D and 22E into repo docs
3. Add C1 route/category and export UI controls
4. Implement `mapToCDS_C1`
5. Add C1 rule definitions and reduced-field validation
6. Implement accepted C1 → supplementary B1 flow
7. Add C1 fixtures and run export regression suite

### 3.11 Definition of done for C1

C1 is ready for engineering sign-off only when:

- Appendix 22D/22E mirror exists and is reviewed
- B1 export baseline is stable and regression-safe
- reduced-form UI is working and category-specific
- `mapToCDS_C1` is tested against valid and invalid fixtures
- supplementary-export linkage from accepted C1 to B1 is configured
- H1 + B1 import/export regression remains green

---

## Build order

1. Spec mirrors + mapper split (don’t break H1)
2. **B1** export MVP
3. **I1** frontier (parallel OK if separate dev)
4. **C1** frontier (after B1)
5. Supplementary flows (I1 then C1)
6. FSD + occasional variants

---

## Main files

| Area | Files |
|------|--------|
| Spec | `docs/hmrc/specs/cds-api/appendix-21f-*.md`, `appendix-22*.md` |
| Mapper | `src/lib/wco-mapper*.ts`, `src/lib/cds-xml-renderer.ts` |
| Backend | `convex/schema.ts`, `convex/declarations.ts`, `rule_seed.ts` |
| UI | Declaration create/edit, type selector, supplementary wizard |
| Tests | `tests/cds/`, `test-evidence/fixtures/cds/` |

**Regression:** `npm run test:tdr` must stay green throughout.
