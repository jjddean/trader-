# ENS specification — version tracking

**Status:** ACTIVE — process document

This pack is a stored copy of external regulatory infrastructure. It is **not a
cache** and must not be silently refreshed.

---

## Current baseline

| | |
|--|--|
| HMRC service | Safety & Security GB |
| API version | 1.0 (beta) — Declarations, Outcomes, Notifications |
| Service guide version | 1.10 |
| Specification retrieved | 2026-08-22 |
| Retrieved by | Initial pack creation |

HMRC service guide changelog at time of retrieval ran to **v1.10**:

| Guide version | Change |
|---------------|--------|
| 1.7 | Corrected `IDEMEATRAGI970` field ID; added `SEAID529`, previously missing |
| 1.8 | Added type, length and requirement information to XML field descriptions; added the Appendix code tables |
| 1.9 | `PRTNOT640` and `NOTPAR670` — address children must not be provided when the notify party has a GB EORI |
| 1.10 | `PlaLoaGOOITE334`, `PlaUnlGOOITE334`, `PlaLoaGOOITE333`, `PlaUnlGOOITE333` clarified as conditional |

Full changelog: [`api/service-guide-overview.md`](api/service-guide-overview.md).

---

## Update procedure

Do not overwrite this pack in place.

1. Download to a scratch directory, not into `docs/hmrc/ens/`.
2. Diff against the stored copy.
3. Record the result below, including "no change" runs.
4. Only then copy in the changed files, and in the same change update any
   generated JSON from its mirror.
5. Re-run the verification in step 7 below.

## What to diff

| Area | Files | Why it matters |
|------|-------|----------------|
| Schema changes | `schemas/**/*.xsd` | Element, type, pattern or cardinality changes break generation |
| Field changes | `reference/fields.md`, `reference/raw/fields.json` | A requirement letter flipping M↔C changes what must be collected |
| Validation rules | `validation/*.md`, `validation/business-rules.json` | New or altered codes and conditions |
| Endpoints | `api/*.md` | Paths, methods, headers, scopes |
| Code lists | `reference/*.md`, `reference/raw/*.json` | Added or withdrawn codes |
| Guide version | `api/service-guide-overview.md` | The changelog states what HMRC thinks changed |
| Test headers | `api/declarations.md`, `testing/sandbox.md` | Sandbox behaviour changes invalidate the test matrix |

## Generated files

These are derived, never hand-edited. Regenerate only from the mirror in this
pack:

| Generated | Derived from |
|-----------|--------------|
| `validation/business-rules.json` | `validation/new-ens-rules.md`, `validation/amendment-rules.md` |
| `validation/error-codes.json` | `validation/business-rules.json` |
| `reference/raw/fields.json` | `reference/fields.md` |
| `reference/raw/*.json` (9 code lists) | the matching `reference/*.md` |

## Verification after any update

1. All 13 root schemas still compile offline.
2. `validSubmission.xml`, `CC315A_reduced.xml` and `validAmendment.xml` still
   validate against their schemas.
3. Rule and code-list counts recorded below, and any change explained.
4. `SOURCES.md` retrieval dates updated.

---

## History

### 2026-08-22 — initial retrieval

Baseline. Nothing to diff against.

Captured:

| | Count |
|--|-------|
| XSD files (HMRC) | 27 |
| XSD files (W3C dependencies) | 2 |
| Root schemas compiling offline | 13 / 13 |
| HMRC example payloads | 5 |
| — validating against their schema | 3 |
| Business validation rules | 375 (188 IE315 + 187 IE313) |
| Distinct error codes | 182 |
| Field definitions | 151 |
| Code lists | 9 |
| Code-list entries | 1,699 |

Findings recorded at retrieval:

1. `CC315A_full.xml` and `CC313A_reduced.xml` fail HMRC's own schema — they hold
   placeholder values (`undg`, `comco`, `gb`, `mrn`). Not edited. See
   `SOURCES.md` §4.
2. The five sandbox simulation headers are documented on the rendered
   Developer Hub API page but **not** in the OpenAPI file. Anyone regenerating
   from the OAS alone will miss them.
3. Declarations ships `v11-2` supporting schemas while Outcomes and
   Notifications ship `v10-0`. Kept separate deliberately.
4. `SuccessResponse-v2-0.xsd` imports two W3C schemas HMRC does not host. Taken
   from W3C so the set compiles offline; they are the only non-HMRC files under
   `schemas/`.
