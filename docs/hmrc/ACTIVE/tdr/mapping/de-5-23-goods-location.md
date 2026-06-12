# DE 5/23 — Location of Goods

| | |
|--|--|
| Obligation (H1) | **A** — Mandatory, **Y** — Header level, 1x |
| Source — completion guide | https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-5-dates-times-periods-places-countries-and-regions |
| Source — code lists | https://www.gov.uk/government/collections/goods-location-codes-for-data-element-523-of-the-customs-declaration-service |
| Retrieved | 2026-05-27 |

## Field format (verbatim from completion guide)

> | Declaration Categories | Field format | No. of occurrences at header level | No. of occurrences at item level |
> | --- | --- | --- | --- |
> | H1, H2, H3, H4, H5, H7, I1 C&F and I1 B&E | Country: a2 + Type of location: a1 + Qualifier of the identification: a1 + Coded Identification of location an..35 + Additional identifier n..3 | 1x | NA |

Components, in order:

| # | Component | Format | Source |
|---|-----------|--------|--------|
| 1 | Country | a2 | Appendix 13 |
| 2 | Type of location | a1 | Appendix 16 (the appendix you pick implies the Type) |
| 3 | Qualifier of the identification | a1 | Appendix 16 (the appendix you pick implies the Qualifier) |
| 4 | Coded Identification of location | an..35 | Appendix 16A–R column 2 (consolidated code) |
| 5 | Additional identifier | n..3 | optional |

## Completion rule (verbatim)

> The Codes shown in column 2 of Appendices 16 DE 5/23: Goods Location Codes (with the exclusion of Appendix 16I) are the consolidated location codes to be declared in DE 5/23.

> The goods location codes specified in Appendix 16 (excluding Appendix 16I) should be declared in DE 5/23 unless the DE 1/10 Procedure Code specifies otherwise.

> Where goods are being declared at a GVMS location (see Appendix 16S), Additional Information Code 'RRS01' must also be declared in DE 2/2 and a GVMS location code from Appendix 16S declared in DE 5/23.

> For goods being moved through a Northern Ireland Goods Location … one of Additional Information Codes 'NIDOM' or 'NIIMP' must also be declared in DE 2/2.

## What HMRC does NOT publish (gap)

HMRC publishes:
- the consolidated string format (`GBAUFXTFXTGW`)
- the column-2 codes per appendix
- the type/qualifier semantics (A/B/C/D and U/Y)

HMRC's public Tariff Vol 3 + Appendix 16 do **not** publish the WCO XML element structure (`<Name>` vs `<ID>` vs `<TypeCode>` vs `<Address>`) used by CDS.

The XML element shape is implied by:
- CDS XSD (not publicly hosted as far as known)
- HMRC SDS (Software Developer Support — direct contact)
- DMSACC evidence (none in this project)

## Lane row — Appendix 16C verbatim (resolved 2026-05-27)

Source: `hmrc-mirror/appendix-16c-maritime.ods` (published 2026-05-18) → `hmrc-mirror/appendix-16c-felixstowe.md`

Column headers in the current ODS:
| Column | Header |
|--------|--------|
| 1 | Name |
| 2 | Address |
| 3 | **Location Code** |
| 4 | Northern Ireland Location (Yes or No) |

Felixstowe row:

| Col 1 | Col 2 | Col 3 | Col 4 |
|-------|-------|-------|-------|
| Felixstowe Dock & Railway Company T/A Port of Felixstowe | (empty) | **`GBAUFXTFXTFXT`** | No |

### Important: column number source-conflict

- Group 5 completion guide says "column 2 of Appendices 16" — outdated, predates the 28 March 2026 ODS structure change.
- Appendix 16C page itself says "column 3" — matches the current ODS.

The **ODS file is authoritative**: column 3 = location code.

### Project mismatch

The repo has used `GBAUFXTFXTGW` for this lane. **That code does not exist anywhere in the current Appendix 16C ODS.** Searched: `Select-String -Pattern "GBAUFXTFXTGW"` returns zero matches. All prior DMSREJ responses against that code are therefore against a non-existent location code, which alone explains CDS rejections regardless of XML shape.

**Required action:** update mapper + UI + Convex to use `GBAUFXTFXTFXT`. Cite `docs/hmrc/specs/cds-api/mirrors/appendix-16c-felixstowe.md`.

## XML shape — INFERENCE (accepted 2026-05-27)

After submitting with the corrected code `GBAUFXTFXTFXT` (Name + ID only), HMRC returned CDS10001 against `64A/L110`, `64A/04A`, and `64A/04A/410`. This is **negative evidence** confirming that the Name+ID-only shape is rejected.

Project owner accepted inference risk on 2026-05-27 in lieu of contacting HMRC SDS.

### Inferred element mapping (revised 2026-05-31 21:03)

HMRC XSD validator rejected `<CountryCode>` at GoodsLocation root with `BAD_REQUEST / xml_validation_error: cvc-complex-type.2.4.a: Invalid content was found starting with element 'CountryCode'. One of '{Address}' is expected.`

So in the WCO XSD, `<CountryCode>` cannot appear directly under `<GoodsLocation>` — it only exists inside `<Address>`. The `L016` pointer in earlier DMSREJ messages refers to `Address.CountryCode` (the path notation truncates leading parents).

App submit `FC-MPU9NSCQ` (MRN `26GB5ZL62L96SAEAR5`) then returned CDS12070 on `64A/L016` and `64A/04A/410` while the XML placed `FXTFXTFXT` in `GoodsLocation/ID` and omitted `GoodsLocation/Name`. The repo's HMRC WCO reference extract maps:

- `GoodsLocation/ID` to "Location of Goods - Additional Identifier" (`n..3`, optional)
- `GoodsLocation/Name` to "Location of Goods - Identification of Location" (`an..35`)

That means the coded identification belongs in `<Name>`, not `<ID>`. This is still an inference until DMSACC or HMRC SDS confirms it, but it is now the only mapping consistent with both the XSD and the WCO reference extract.

| Field-format component (cited) | WCO pointer (DMSREJ-observed) | XSD position | Value for `GBAUFXTFXTFXT` |
|--------------------------------|-------------------------------|--------------|---------------------------|
| Country a2 | `64A/L016` | `GoodsLocation/Address/CountryCode` | `GB` |
| Type of location a1 | `64A/L110` | `GoodsLocation/TypeCode` | `A` |
| Qualifier of identification a1 | `64A/04A/410` | `GoodsLocation/Address/TypeCode` | `U` |
| Coded Identification an..35 | `64A/L016` | `GoodsLocation/Name` | `FXTFXTFXT` |
| Additional identifier n..3 | `64A/ID` | omitted for this lane | n/a |

**`<ID>` is not emitted** — this lane has no additional identifier.

### Emitted XML for this lane

```xml
<GoodsLocation>
  <Name>FXTFXTFXT</Name>
  <TypeCode>A</TypeCode>
  <Address>
    <TypeCode>U</TypeCode>
    <CountryCode>GB</CountryCode>
  </Address>
</GoodsLocation>
```

### Confidence

- **High confidence**: positions 1-2 = Country, position 3 = Type, position 4 = Qualifier, positions 5+ = Coded ID. Direct from HMRC completion guide.
- **Medium confidence**: tag-pointer-to-WCO-element mapping (`L016`→`Name` at GoodsLocation root and country at Address child, `L110`→`TypeCode`). Standard WCO Data Model — reference only per spec policy.
- **Inference**: whether `<Name>` should contain the coded-id suffix (`FXTFXTFXT`) or the full consolidated code (`GBAUFXTFXTFXT`). Current choice is suffix because Country/Type/Qualifier are emitted in separate XML elements.

If DMSREJ on this shape includes any of `L016` / `L110` / `04A` / `04A/410` again, the inference is wrong and we need HMRC SDS.

### Files touched by this inference

- `src/lib/goods-location.ts` — `splitConsolidatedLocationCode()` + `resolvePortGoodsLocation()` returning split
- `src/lib/h1-xml-renderer.ts` — GoodsLocation render block emits `Name + TypeCode + Address(TypeCode, CountryCode)` and omits `ID`
- `test-evidence/run-hmrc-scenarios.js` — scenario runner matches the renderer
- `tests/h1/mapper-xml.test.ts` — asserts split shape

All carry an `INFERENCE` comment referencing this spec entry.

## Known errors (CDS) referencing DE 5/23

| Code | Pointer | Meaning |
|------|---------|---------|
| CDS10001 | 64A, 64A/L110, 64A/04A, 64A/04A/410 | Mandatory data element missing for the chosen Type/Qualifier combination |
| CDS12099 | 64A, 64A/L016, 64A/L110, 64A/04A/410 | Invalid combination of elements that make up the goods location code |

Resolution path: HMRC SDS or sourcing a DMSACC reference payload — see `errors-handled.md`.
