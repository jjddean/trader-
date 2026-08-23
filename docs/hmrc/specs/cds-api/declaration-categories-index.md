# CDS declaration categories — index (spec mirror)

| | |
|--|--|
| **Status** | Verbatim excerpts from GOV.UK + HMRC Developer Hub |
| **Retrieved** | 2026-06-20 |
| **Behaviour authority** | `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` — this file is data only |
| **Build plan** | `docs/hmrc/FUTURE/CDS-EXPANSION-BUILD-PLAN.md` |

Do not implement mapper or validation changes from this file alone. Fetch the linked Appendix data-set tables before coding.

---

## 1. API transport (same for all categories)

Source: [Customs Declarations API v2.0](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/2.0) · [End-to-end service guide — submitting declarations](https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/submitting-import-and-export-customs-declarations.html)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/customs/declarations/` | POST | Submit any UCC/WCO declaration (import, export, simplified, supplementary) |
| `/customs/declarations/amend` | POST | Amend |
| `/customs/declarations/cancellation-requests` | POST | Cancel (pre-clearance) |

There is **no separate API** for simplified vs standard declarations. Category is determined by **DE 1/1** (declaration type) + **DE 1/2** (additional declaration type) in the XML payload.

E2E guide (imports): traders must make a **full declaration** unless **authorised** to use simplified declarations.

---

## 2. Declaration category index (Appendix 21 / 22)

Source: [CDSSG04130 — Finding the Declaration Category and Data Set](https://www.gov.uk/hmrc-internal-manuals/customs-cds-volume-3-tariff-step-by-step-guide/cdssg04130) (retrieved 2026-06-20)

| Appendix | Category | Declaration title | Usage (abbrev.) |
|----------|----------|-------------------|-----------------|
| 21A | **H1** | Release for free circulation / end-use | Standard import (Freightcode baseline) |
| **21B** | **H2** | Customs warehousing | Special procedure — [`appendix-21b-h2-obligations.md`](appendix-21b-h2-obligations.md) |
| 21C | H3 | Temporary admission | Special procedure |
| 21D | H4 | Inward processing | Special procedure |
| 21E | H5 | Special fiscal territories | Import |
| **21F** | **I1 C&F** | Import Simplified Declaration (SDP) regular use | DE 1/2 **C + F** |
| **21G** | **I1 B&E** | Import Simplified Declaration occasional basis | DE 1/2 **B + E** |
| 21H | H7 | Super Reduced Data Set | Low-value relief |
| **22A** | **B1** | Export / Re-export Standard Declaration | Standard export (+ EXS in combined set) |
| 22B | B2 | Outward processing | Special procedure export |
| 22C | B4 | Dispatch to special fiscal territory | Export |
| **22D** | **C1 C&F** | Export/Re-export Simplified regular use | DE 1/2 **C + F** (former PSA) |
| **22E** | **C1 B&E** | Export/Re-export Simplified occasional basis | DE 1/2 **B + E** |
| 23A–D | C21i / C21e | Inventory clearance requests | Out of scope for written decl expansion |
| 24A | FSD | Final Supplementary Declaration | Import SDP/EIDR reporting |

---

## 3. Type of movement → category (step-by-step)

Source: [CDSSG06030 — Type of Declaration being made](https://www.gov.uk/hmrc-internal-manuals/customs-cds-volume-3-tariff-step-by-step-guide/cdssg06030) (retrieved 2026-06-20)

| Type of movement | Type of declaration | Categories available |
|------------------|---------------------|----------------------|
| Import | Standard | H1 – H5 |
| Import | Simplified (regular use)* | **I1 C&F** |
| Import | Supplementary | H1 – H5 |
| Import | Simplified (occasional) | **I1 B&E** |
| Export | Standard | B1, B2, B4 |
| Export | Simplified (regular use) | **C1 C&F** |
| Export | Supplementary | B1, B2, B4 |
| Export | Simplified (occasional) | **C1 B&E** |
| Export | Combined (re)export + EXS | B1, B2, B4, C1 C&F, C1 B&E |

\*Import simplified (regular use): certain procedure codes require **H1 instead of I1** — check Appendix 1 completion notes for the CPC in use.

Footnote (CDSSG06030): Where a **C\*** simplified export is made, the **H1 data set** (Appendix 21A) must be used and the **supplementary declaration is waived**.

---

## 4. Import categories (Volume 3 Imports — general notes)

Source: [Import completion guide — general notes](https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/uk-trade-tariff-cds-volume-3-import-declaration-completion-guide) (retrieved 2026-06-20)

| Category | Description |
|----------|-------------|
| H1 | Release for free circulation and special procedure: specific use (end use) |
| H2 | Special procedure: storage (customs warehousing) |
| H3 | Special procedure: specific use (temporary admission) |
| H4 | Special procedure: processing (inward processing) |
| H5 | Introduction of goods — trade with special fiscal territories / customs union territories |
| H7 | Super Reduced Data Set (SRDS) |
| **I1 C&F** | Import simplified declaration with **regular use** (DE 1/2 codes **C&F**) |
| **I1 B&E** | Import simplified declaration on an **occasional basis** (DE 1/2 codes **B&E**) |

**Supplementary import declarations** use categories **H1, H3, H4, H5** data sets (not I1).

**Accept Date** (tax point for SDP/EIDR supplementary declarations, DE 1/2 types Y or Z): declared in XML schema; no standalone DE.

Data sets: **Appendix 21** — separate table per category (21A = H1, **21F = I1 C&F**, **21G = I1 B&E**).

---

## 5. Export categories (Volume 3 Exports — general notes)

Source: [Export completion guide — general notes](https://www.gov.uk/government/publications/uk-trade-tariff-cds-volume-3-export-declaration-completion-guide/general-notes-on-reading-data-element-completion-rules) (retrieved 2026-06-20)

| Category | Description |
|----------|-------------|
| **B1** | Export Standard Declaration or Re-export Standard Declaration |
| B2 | Special Procedures — Outward Processing |
| B3 | Customs warehousing Union goods (not currently used in UK) |
| B4 | Dispatch to special fiscal territory / customs union territory |
| **C1 C&F** | Export or Re-export Simplified Declaration (**Regular Use**) |
| **C1 B&E** | Export Simplified Declaration (**occasional basis**) |

UCC correlation:

- Standard = full customs declaration (**B1**)
- SDP regular use = **C1 C&F** (DE 1/2 **C&F**); formerly Pre-Shipment Advice (PSA)
- Occasional simplified = **C1 B&E** (DE 1/2 **B&E**)
- **Supplementary export** data sets: **B1** and **B4** (Appendix 22)

**EXS (Exit Summary):** embedded in B1, B2, C1 C&F, C1 B&E for UK CDS pre-departure; not a standalone export category. Stand-alone EXS via **C21e** only.

Combined fiscal + EXS pre-departure data sets: **B1**, **B2**, **C1 C&F**, **C1 B&E**.

Data sets: **Appendix 22** — separate table per category (22A = B1, **22D = C1 C&F**, **22E = C1 B&E**).

---

## 6. I1 conditional DE examples (from in-repo Group 5 mirror)

Source: `docs/hmrc/specs/cds-api/mirrors/group-5-completion-guide.md` (GOV.UK Group 5 imports)

| DE | I1 C&F rule (excerpt) |
|----|------------------------|
| 5/8 Country of destination | Required on simplified declaration **where specified by Procedure Code** (Appendix 1) |
| 5/14 Country of dispatch | Required on simplified declaration **where controlled goods** entered on simplified declaration |
| 5/23 Location of goods | Same category row as H1–H7, I1 C&F, I1 B&E |
| 5/26 Customs office of presentation | Required on simplified declaration **where SASP authorisation** held |
| 5/27 Supervising customs office | Per procedure code completion notes (Appendix 1) |

Full I1 obligation table: fetch **Appendix 21F / 21G** from GOV.UK (not yet mirrored in repo).

---

## 7. Trader authorisation (not software registration)

Source: [Using simplified declarations for imports](https://www.gov.uk/guidance/using-simplified-declarations-for-imports) (retrieved 2026-06-20)

Before a trader may use simplified import procedures:

- HMRC **authorisation** (form **C&E48**)
- UK **EORI**
- **Duty deferment account**
- Software communicating with CDS for **supplementary declarations**
- Good compliance record; 4-year record keeping

Software claiming simplified capability on HMRC production checklist ≠ trader authorisation.

---

## 8. Appendix URLs to fetch before implementation

| Target | URL |
|--------|-----|
| Appendix 21F (I1 C&F) | https://www.gov.uk/government/publications/appendix-21-import-declaration-category-data-sets |
| Appendix 21G (I1 B&E) | (same collection — index lists 21G) |
| Appendix 22A (B1) | https://www.gov.uk/government/publications/appendix-22-export-declaration-category-data-sets |
| Appendix 22D (C1 C&F) | (same collection — index lists 22D) |
| Appendix 22E (C1 B&E) | (same collection — index lists 22E) |
| Appendix 24 (FSD) | https://www.gov.uk/government/publications/appendix-24-import-final-supplementary-declaration-data-sets |
| Export completion groups 1–8 | https://www.gov.uk/guidance/navigate-the-uk-trade-tariff-cds-volume-3-for-exports |

Existing in-repo mirrors: **Appendix 21A (H1)** only — `appendix-21a-h1-obligations.md`, `mirrors/appendix-21a-h1-page.md`.

---

## 9. WCO TypeCode mapping (Freightcode current)

Source: `src/lib/wco-mapper.ts` — `mapDeclarationType()`

| Route | Prefix | Suffix from `declarationType` |
|-------|--------|-------------------------------|
| import | `IM` | A, B, C, D, E, F, J, K, Y, Z |
| export | `EX` | same suffix set |

Default today: **IMA** (standard frontier import). Export/simplified suffix selection is **not** wired to category-aware UI or obligation tables.
