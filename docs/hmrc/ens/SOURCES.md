# ENS specification pack — provenance

**Status:** ACTIVE — reference data only, no behaviour

Every artifact in this pack is recorded below. Nothing here is paraphrased from
a blog, vendor page or model output. Where a file could not be obtained, that is
stated rather than substituted.

| | |
|--|--|
| HMRC service | Safety & Security GB (S&S GB) |
| API version | 1.0 (beta) — all three APIs |
| Service guide version | 1.10 (latest changelog entry captured) |
| Specification retrieved | 2026-08-22 |
| Retrieval method | Direct HTTPS download (`curl`), no intermediary |

---

## 1. HMRC API specifications (OpenAPI 3.0.3)

The Developer Hub serves a machine-readable OAS for each API at
`/api-documentation/docs/api/service/{service}/1.0/oas/file`. These are the
normative endpoint definitions.

| Name | Official URL | Version | Retrieved | Local path | Purpose |
|------|--------------|---------|-----------|------------|---------|
| Safety and Security Import Declarations API | https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/import-control-entry-declaration-store/1.0 | 1.0 beta | 2026-08-22 | `api/declarations.md` | Submit new ENS (IE315), submit amendment (IE313) |
| Safety and Security Import Outcomes API | https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/import-control-entry-declaration-outcome/1.0 | 1.0 beta | 2026-08-22 | `api/outcomes.md` | List, retrieve and acknowledge outcomes |
| Safety and Security Import Notifications API | https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/import-control-entry-declaration-intervention/1.0 | 1.0 beta | 2026-08-22 | `api/notifications.md` | List, retrieve and acknowledge advanced notifications / Do Not Load |

**Source type:** HMRC API specification.

> The three `api/*.md` files are mirrors of the rendered Developer Hub pages,
> which carry the sandbox test-header documentation that the OAS files do not.
> The OAS files themselves were used to discover every schema and example URL
> below; they are not stored separately because their entire normative content
> (endpoints, headers, schema references) is reproduced in the mirrors and in
> `IMPLEMENTATION_SPEC.md`.

---

## 2. HMRC service guide

Static HTML pages under the end-to-end service guide. Mirrored verbatim.

| Name | Official URL | Retrieved | Local path | Purpose |
|------|--------------|-----------|------------|---------|
| Service guide — overview and changelog | https://developer.service.hmrc.gov.uk/guides/safety-and-security-import-declarations-end-to-end-service-guide/ | 2026-08-22 | `api/service-guide-overview.md` | End-to-end journeys, changelog to v1.10 |
| Service guide — set up | .../documentation/set-up.html | 2026-08-22 | `api/service-guide-set-up.md` | Enrolment, CSPs, test environment, DNL |
| Service guide — API reference | .../documentation/api-reference.html | 2026-08-22 | `api/service-guide-api-reference.md` | Endpoint overview, submission, amendment, outcomes, IE351 |
| Service guide — XML field descriptions | .../documentation/xml-field-descriptions.html | 2026-08-22 | `reference/fields.md` | 151 fields with type, length, requirement |
| Service guide — penalties | .../documentation/penalties.html | 2026-08-22 | `reference/penalties.md` | Penalty policy |

Base for the abbreviated paths above:
`https://developer.service.hmrc.gov.uk/guides/safety-and-security-import-declarations-end-to-end-service-guide`

**Source type:** HMRC service guide.

---

## 3. HMRC XML schemas (XSD)

Downloaded from
`/api-documentation/docs/api/download/{service}/1.0/schemas/{file}`.
**Unmodified.** Byte-for-byte as served.

Note the version split: the declarations API ships `v11-2` supporting types,
while outcomes and notifications ship `v10-0`. They are deliberately kept in
separate directories and must not be merged — the two sets are not identical.

### `schemas/declarations/` — API: import-control-entry-declaration-store

| File | Root message | Purpose |
|------|--------------|---------|
| `CC315A-v11-2.xsd` | IE315 | **New ENS submission** |
| `CC313A-v11-2.xsd` | IE313 | **ENS amendment** |
| `SuccessResponse-v2-0.xsd` | — | Successful submission response (carries correlation ID) |
| `errorresponse-v2.0.xsd` | — | Schema and business validation error response |
| `complex_types_ics-v11-2.xsd` | — | Imported complex types |
| `simple_types-v11-2.xsd` | — | Imported simple types |
| `tcl-v11-2.xsd` | — | Imported code lists |
| `doc-v11-2.xsd` | — | Imported document types |
| `xml.xsd` | — | **W3C**, not HMRC — see note below |
| `xmldsig-core-schema.xsd` | — | **W3C**, not HMRC — see note below |

### `schemas/outcomes/` — API: import-control-entry-declaration-outcome

| File | Root message | Purpose |
|------|--------------|---------|
| `CC328A-v10-0.xsd` | IE328 | Accepted outcome — carries the MRN |
| `CC316A-v10-0.xsd` | IE316 | Rejected outcome |
| `CC304A-v10-0.xsd` | IE304 | Amendment accepted |
| `CC305A-v10-0.xsd` | IE305 | Amendment rejected |
| `outcomes.xsd` | — | List-outcomes response wrapper |
| `pollingResponse.xsd` | — | Polling response wrapper |
| `complex_types_ics-v10-0.xsd`, `simple_types-v10-0.xsd`, `simple_types_ics-v10-0.xsd`, `tcl-v10-0.xsd`, `tcl_ics-v10-0.xsd`, `doc-v10-0.xsd` | — | Imported dependency set |

### `schemas/notifications/` — API: import-control-entry-declaration-intervention

| File | Root message | Purpose |
|------|--------------|---------|
| `CC351A-v10-0.xsd` | IE351 | **Do Not Load / intervention** |
| `advancedNotification.xsd` | — | Retrieve-notification wrapper |
| `listInterventions.xsd` | — | List-notifications response |
| `complex_types_ics-v10-0.xsd`, `simple_types-v10-0.xsd`, `simple_types_ics-v10-0.xsd`, `tcl-v10-0.xsd`, `tcl_ics-v10-0.xsd`, `doc-v10-0.xsd` | — | Imported dependency set |

**Source type:** HMRC XML/XSD.

### W3C dependencies — not HMRC-hosted

`SuccessResponse-v2-0.xsd` imports two W3C schemas by relative
`schemaLocation`, but HMRC does not serve them from the download path. Without
them the declarations schema set does not compile offline. They were taken from
W3C and placed alongside:

| File | Official URL | Retrieved | Authority |
|------|--------------|-----------|-----------|
| `schemas/declarations/xml.xsd` | https://www.w3.org/2001/xml.xsd | 2026-08-22 | W3C, not HMRC |
| `schemas/declarations/xmldsig-core-schema.xsd` | https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd | 2026-08-22 | W3C, not HMRC |

These two are the **only** files in `schemas/` that did not come from HMRC.

### Compile verification

All 13 root schemas were compiled with `lxml.etree.XMLSchema` from the local
copies, with no network access, on 2026-08-22. All 13 compile, which proves the
imported dependency set is complete.

---

## 4. HMRC example payloads

Downloaded from
`/api-documentation/docs/api/download/import-control-entry-declaration-store/1.0/examples/`.
Referenced by the OAS as `externalValue`.

| File | Local path | Validates against its schema? |
|------|------------|-------------------------------|
| `validSubmission.xml` | `examples/new-ens/validSubmission.xml` | **Yes** |
| `CC315A_reduced.xml` | `examples/new-ens/CC315A_reduced.xml` | **Yes** |
| `CC315A_full.xml` | `examples/new-ens/CC315A_full.xml` | **No** — see below |
| `validAmendment.xml` | `examples/amendment/validAmendment.xml` | **Yes** |
| `CC313A_reduced.xml` | `examples/amendment/CC313A_reduced.xml` | **No** — see below |

**Source type:** HMRC XML example.

> **Finding — two HMRC examples fail HMRC's own schema.**
> `CC315A_full.xml` and `CC313A_reduced.xml` contain placeholder text where coded
> values are required: `undg` in `UNDanGooCodGDI1`, `comco` in `ComNomCMD1`, `gb`
> in `NatIDEMEATRAGI973`, `mrn` in `DocNumHEA5`. They are field-illustration
> templates, not valid instances.
>
> Nothing was edited to make them pass, per the standing rule against modifying
> HMRC artifacts. Use `validSubmission.xml`, `CC315A_reduced.xml` and
> `validAmendment.xml` as golden fixtures; treat the other two as documentation
> of field placement only.

---

## 5. HMRC validation rules

| Name | Official URL | Retrieved | Local path |
|------|--------------|-----------|------------|
| New ENS (IE315) Level 2 business validation | .../documentation/Level2Validation-315.html | 2026-08-22 | `validation/new-ens-rules.md` |
| Amended ENS (IE313) Level 2 business validation | .../documentation/Level2Validation-313.html | 2026-08-22 | `validation/amendment-rules.md` |

Derived machine-readable forms, generated from those mirrors:

| Local path | Contents |
|------------|----------|
| `validation/business-rules.json` | 375 rules (188 IE315 + 187 IE313), each with error code, XML context element and **verbatim** scenario text |
| `validation/error-codes.json` | 182 distinct codes indexed by band, message and context |

**Source type:** HMRC validation rule.

Scenario text is copied character-for-character. It was not summarised, because
the exact condition is the rule.

---

## 6. HMRC reference / code lists

All nine appendices from
`.../documentation/appendix.html`, retrieved 2026-08-22.

| Code list | Markdown mirror | Normalised JSON | Entries |
|-----------|-----------------|-----------------|---------|
| Method of Payment | `reference/method-of-payment.md` | `reference/raw/method-of-payment.json` | 7 |
| Document Type | `reference/document-types.md` | `reference/raw/document-types.json` | 603 |
| Mode of Transport | `reference/modes-of-transport.md` | `reference/raw/modes-of-transport.json` | 7 |
| Additional Information | `reference/additional-information.md` | `reference/raw/additional-information.json` | 7 |
| Country Code | `reference/country-codes.md` | `reference/raw/country-codes.json` | 264 |
| Acceptable Goods Descriptions | `reference/acceptable-goods-descriptions.md` | `reference/raw/acceptable-goods-descriptions.json` | 211 |
| Kinds of Package | `reference/package-types.md` | `reference/raw/package-types.json` | 406 |
| Specific Circumstance Indicator | `reference/specific-circumstance-indicators.md` | `reference/raw/specific-circumstance-indicators.json` | 4 |
| Language Code | `reference/language-codes.md` | `reference/raw/language-codes.json` | 190 |

**Total: 1,699 entries.**

**Source type:** HMRC reference/code list.

The markdown mirror is the copy of record. The JSON is generated from it, so the
generated form can always be diffed back against HMRC.

Field catalogue: `reference/raw/fields.json` — 151 fields generated from
`reference/fields.md` (79 mandatory, 37 optional, 34 conditional, 1 "M except
for air movements").

---

## 7. Not obtained

| Item | Reason |
|------|--------|
| Downloadable JSON Schema | HMRC does not publish one for this service. The APIs are XML; JSON appears only as the OAS envelope. |
| Outcome / notification example payloads | HMRC publishes `externalValue` examples for the declarations API only. The outcomes and notifications OAS files reference schemas but ship no example instances. `examples/outcomes/` and `examples/notifications/` are therefore empty of HMRC-authored files. |
| Machine-readable business rules | HMRC publishes the Level 2 rules as HTML prose only. `validation/business-rules.json` is generated by parsing that HTML; the mirror remains authoritative. |
| Sandbox test-user provisioning for S&S GB | The service guide states an S&S GB test user may be required but does not document a create-test-user endpoint for this service. |

---

## 8. Rules for future updates

1. Never edit a file under `schemas/`, `examples/`, or any `*.md` mirror by
   hand. Re-download it.
2. Never regenerate `reference/raw/*.json` or `validation/*.json` from anything
   other than the mirrors in this pack.
3. Record every re-retrieval in `CHANGELOG_TRACKING.md` with a diff summary.
4. HMRC (gov.uk) overrides every other source, consistent with
   `docs/hmrc/specs/README.md` §"Source policy".
