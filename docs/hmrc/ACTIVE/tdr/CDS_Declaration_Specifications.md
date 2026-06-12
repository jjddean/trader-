# HMRC CDS Declaration Specifications

> **Scope:** HMRC Customs Declaration Service (CDS) declaration category, data element, document, status, and response-handling rules for deterministic TradeDNA validation and WCO payload generation.
>
> **Authority:** GOV.UK HMRC CDS appendices and data guides are the source of truth. Always refresh from the official GOV.UK pages before implementing or changing declaration rules.

---

## 1. Authoritative HMRC Specification Sources

Declaration categories such as H1 and H2 use HMRC Appendix 21 tables to determine which data elements (DEs) are required:

- **H1 standard import declarations:** Appendix 21A.
- **H2 supplementary declarations:** Appendix 21B.
- **Document and certificate codes for DE 2/3:** Appendix 5A.
- **Document status codes:** Appendix 5B.
- **Conditional logic and footnotes:** HMRC Reading Notes for Appendix 21.
- **CDS validation codes:** HMRC published CDS error-code list and data guide.

Do not rely on memory, inference, or AI-generated assumptions. Store and version-control the official HMRC source files used by the implementation, then update them when GOV.UK publishes new versions.

---

## 2. Appendix 21 Symbols

Appendix 21 marks each DE with a requirement symbol and a level symbol.

| Symbol | Meaning |
| --- | --- |
| `A` | Mandatory. The data element is always required by the UK. |
| `C` | Optional. The economic operator may supply the data element. |
| `D` | Dependent on scenario. Required only for specific procedures, modes of payment, comparator fields, or other conditions. |
| `X` | Goods-item level. The element applies per item. |
| `Y` | Header or consignment level. The element applies across the declaration. |

Interpret these exactly as published by HMRC.

Examples from H1 Appendix 21A:

| Data element | Description | Requirement |
| --- | --- | --- |
| DE 1/1 | Declaration type | `A Y` |
| DE 1/2 | Additional declaration type | `A Y` |
| DE 1/10 | Procedure code | `A X` |
| DE 2/1 | Previous documents | `A X,Y` |
| DE 2/3 | Documents produced, certificates, etc. | `D X` |
| DE 2/4 | Document identifier / UCR | `C X,Y` |
| DE 2/5 | Local Reference Number | `A Y` |
| DE 3/18 | Declarant ID | `A Y` |
| DE 5/23 | Location of goods | `A Y` |

H2 Appendix 21B is similar but has category-specific differences. For example, DE 2/3 is `A X` for H2, so it is always required per item under H2.

---

## 3. Conditional and Dependent Data Elements

Many `D` entries in Appendix 21 include footnotes such as `[12a]`, `[12b]`, `[16]`, or `[18a]`. Those notes define the conditions under which a DE is required.

Implementation rules:

1. Parse the relevant Appendix 21 footnotes and reading notes.
2. Implement each condition deterministically in code.
3. Check procedure codes, additional procedure codes, modes of payment, and comparator fields exactly as the reading notes require.
4. Do not populate `D` fields unless the scenario requires or permits them.

Examples:

- Reading note `[12a]` means the field is mandatory unless a specific exemption applies.
- Reading note `[12b]` means a representative ID is required only if the representative entity is different from the declarant in DE 3/18.

---

## 4. Document Data Elements

At goods-item level, each item can have one or more DE 2/3 document entries with corresponding identifiers, status codes, and reasons where required.

| Data element | Description | Practical use |
| --- | --- | --- |
| DE 2/3 | Documents produced, certificates, etc. | The document or certificate code, looked up in Appendix 5A. |
| DE 2/4 | Document identifier / UCR | The document ID, licence number, certificate number, or UCR when required or provided. |
| DE 2/5 | Local Reference Number | Header-mandatory local reference number. |
| DE 2/6 | Document reason | Free-text reason required for waiver or exemption statuses such as `XX` or `XW`, and for specific Y-code scenarios. |

Document-entry rules:

1. Use Appendix 5A to validate every DE 2/3 document code.
2. Use Appendix 5A to determine whether a document ID is required.
3. Use Appendix 5A and Appendix 5B to determine which status codes are allowed.
4. Always supply a valid document status code for every DE 2/3 entry unless the current official HMRC table explicitly says otherwise.
5. Supply DE 2/6 when using waiver or exemption status codes such as `XX` or `XW`.
6. Generate exactly one DE 2/3 to DE 2/6 group for each logical goods-item document.
7. Do not duplicate the same document at both header and item level unless the spec explicitly permits it.

HMRC commonly rejects missing or invalid document status data. For example, `CDS77002` indicates that a document status code must be provided.

---

## 5. Appendix 5A and 5B Document Logic

For each DE 2/3 document entry:

1. Look up the document code in Appendix 5A.
2. Read the Appendix 5A status-code column to identify:
   - Whether a status code is required.
   - Which status codes are valid.
   - Whether a document ID is required.
   - Whether a document reason is required.
3. Look up the selected status code in Appendix 5B for its meaning.
4. Validate the payload against those rules before submission.

Examples:

- Some authorisation codes, such as `C512`, have specific document ID and status requirements.
- Licence and certificate codes often require statuses such as `AC`, `AE`, or other Appendix 5B values.
- Waiver statuses such as `XX` and `XW` require DE 2/6 document reason text.

Do not use `XX` or `XW` lightly. They represent waiver or exemption assertions and require an auditable reason.

---

## 6. Other Code Lists

Many CDS fields depend on official code lists beyond Appendix 21:

- Country codes for DE 5/14, DE 5/15, and DE 5/23 must be valid ISO or HMRC-accepted special codes.
- Currency codes must use valid ISO currency codes.
- Office, location, and UN/LOCODE values must match HMRC-accepted lists.
- Commodity codes must follow Combined Nomenclature, TARIC, and UK Trade Tariff rules.
- Procedure and additional procedure codes must match the declaration category and goods movement.

Validate these lists from official HMRC, UK Trade Tariff, WCO, or ISO sources as applicable.

---

## 7. Strict Validation Before Submission

Before submitting any CDS declaration:

1. Check every Appendix 21 `A` field is present at the correct header or item level.
2. Check every `D` field appears only when the official condition is satisfied.
3. Validate code-list fields against official lists.
4. Validate every DE 2/3 document against Appendix 5A and 5B.
5. Ensure uniqueness constraints are satisfied.
6. Ensure fields are not duplicated at both header and item levels unless explicitly allowed.
7. Validate the generated XML against the WCO message structure.
8. Diff the generated payload against known-good accepted declarations for the same scenario.

The implementation should map each required business value to the exact DE and WCO tag. Do not guess a location.

---

## 8. DMS Response Handling

HMRC replies to CDS submissions through Data Management System (DMS) notifications using HL7 messages.

Key `FunctionCode` values:

| FunctionCode | Notification | Meaning |
| --- | --- | --- |
| `01` | `DMSACC` | Declaration accepted. The declaration is legally accepted and the response includes the MRN and version. |
| `02` | `DMSRCV` | Receipt acknowledged. |
| `03` | `DMSREJ` | Declaration rejected by CDS validation. |

Implementation rules:

1. Parse the DMS XML reply.
2. If `FunctionCode=01`, extract and store the MRN and declaration version from the `<Declaration>` element.
3. If `FunctionCode=03`, extract every `<Error><ValidationCode>` value.
4. Extract pointer data such as `<Pointer>`, `DocumentSectionCode`, and `TagID`.
5. Map pointers back to WCO XML sections and TradeDNA DE context wherever possible.
6. Display or log validation errors with enough context to fix the payload.

---

## 9. Common CDS Validation Codes

Always cross-check the latest official HMRC error-code list. These examples are useful implementation signals but must not replace the published source.

| Code | Meaning | Typical fix |
| --- | --- | --- |
| `CDS10001` | Mandatory data element missing. | Add the required `A` field at the correct header or item level. |
| `CDS12005` | Invalid exporter EORI. | Validate the EORI format and value for DE 3/1 or DE 3/2. |
| `CDS12024` | Uniqueness error. | Remove duplicate values where uniqueness is required. |
| `CDS12056` | Incompatible related fields. | Remove or correct conflicting fields. |
| `CDS12070` | Relation error. | A populated field forbids another populated field. Remove the incompatible field. |
| `CDS12073` | Header-item conflict. | Do not supply the same data at both consignment and item level. |
| `CDS12075` | Relation error variant. | Remove field X when field Y is present, according to the spec. |
| `CDS12099` | Invalid location code for DE 5/23. | Use a valid HMRC location code, country, type, and qualifier combination. |
| `CDS77002` | Document status code must be provided. | Add the correct Appendix 5B status code for the DE 2/3 document. |
| `CDS77005` | Document reason must be entered. | Add DE 2/6 reason text for the relevant Y-code or waiver scenario. |

---

## 10. Interpreting DMSREJ Pointers

`DMSREJ` responses include pointer elements that identify the WCO message section and, sometimes, the tag position.

Guidance:

- `DocumentSectionCode` values such as `42A`, `67A`, and `68A` refer to specific WCO declaration sections.
- Repeated pointers to the same document code often indicate duplicate document entries.
- A `CDS12073` with pointers to both consignment and item sections usually means the same information was supplied at both header and item level.
- `CDS12070`, `CDS12075`, and `CDS12056` usually indicate conflicting related fields.

Use the HMRC HL7 and XML documentation to map section codes back to exact DEs and WCO tags.

---

## 11. Payload Diffing and Known-Good Declarations

Maintain known-good declarations that were accepted by HMRC. For each new or changed scenario:

1. Generate the WCO XML.
2. Diff it against a known-good declaration in the same category and lane.
3. Review differences in procedure code, additional procedure code, document codes, country, location, commodity, valuation, and party details.
4. Confirm every changed field is justified by the current business scenario and HMRC rules.

This helps catch unintended changes when a procedure code, document code, or conditional field changes.

---

## 12. Automated Test Coverage

Automated validation should cover at least:

- Simple H1 import with no extra conditional documents.
- H1 import with additional procedure codes.
- H1 import with item-level documents.
- H1 import with and without fees.
- H2 supplementary declarations.
- Declarations with and without waiver statuses.
- Response parsing for `DMSACC`, `DMSRCV`, and `DMSREJ`.
- Common rejection scenarios such as missing mandatory fields, missing document status, duplicate header/item data, and invalid DE 5/23 location codes.

Tests should fail when the mapping drifts from the official spec.

---

## 13. Implementation Principles

- Use official spec data as local, versioned inputs.
- Keep the spec refresh process auditable.
- Map business fields to DEs and WCO tags deterministically.
- Validate before submission.
- Do not use AI inference to fill or override customs-compliance values.
- Treat CDS errors as authoritative feedback, then resolve them by returning to the official HMRC tables and notes.
- Preserve raw DMS notifications as audit evidence.
