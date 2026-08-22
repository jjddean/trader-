# ENS — Safety & Security GB specification pack

**Status:** FUTURE — not started

| | |
|--|--|
| HMRC service | Safety & Security GB |
| API version | 1.0 (beta) |
| Service guide version | 1.10 |
| Specification retrieved | 2026-08-22 |

Versioned HMRC source material for Entry Summary Declarations, held in-repo so
implementation works from stored specification rather than re-reading HMRC pages.

**No ENS functionality exists.** This pack is documentation and reference data
only. No CDS behaviour was changed to create it.

---

## Where to start

| You want to | Read |
|-------------|------|
| Build ENS | [`IMPLEMENTATION_SPEC.md`](IMPLEMENTATION_SPEC.md) |
| Know where a file came from | [`SOURCES.md`](SOURCES.md) |
| Update this pack later | [`CHANGELOG_TRACKING.md`](CHANGELOG_TRACKING.md) |
| Understand an HMRC rejection | [`validation/error-codes.md`](validation/error-codes.md) |
| Test against sandbox | [`testing/sandbox.md`](testing/sandbox.md) |

---

## Layout

```
docs/hmrc/ens/
  README.md                  this file
  SOURCES.md                 provenance for every artifact
  IMPLEMENTATION_SPEC.md     HMRC spec → FreightCode engineering requirements
  CHANGELOG_TRACKING.md      version baseline and update procedure

  api/                       verbatim mirrors of the HMRC API pages and guide
    declarations.md            submit new ENS + amendment, and the test headers
    outcomes.md                list / retrieve / acknowledge outcomes
    notifications.md           list / retrieve / acknowledge notifications
    service-guide-overview.md  journeys + changelog to v1.10
    service-guide-set-up.md    enrolment, CSPs, test environment
    service-guide-api-reference.md  endpoint reference with XML samples

  schemas/                   HMRC XSDs, unmodified
    declarations/              CC315A (new ENS), CC313A (amendment), responses
    outcomes/                  CC328A, CC316A, CC304A, CC305A + wrappers
    notifications/             CC351A (Do Not Load) + wrappers

  validation/
    new-ens-rules.md           IE315 Level 2 rules, verbatim
    amendment-rules.md         IE313 Level 2 rules, verbatim
    business-rules.json        375 rules, machine-readable
    error-codes.md             bands and how to use the catalogue
    error-codes.json           182 codes indexed

  reference/
    fields.md                  151 XML fields with type, length, requirement
    penalties.md               HMRC penalty policy
    method-of-payment.md  document-types.md  modes-of-transport.md
    additional-information.md  country-codes.md  package-types.md
    specific-circumstance-indicators.md  language-codes.md
    acceptable-goods-descriptions.md
    raw/                       generated JSON — 9 code lists + fields.json

  examples/
    new-ens/                   validSubmission.xml, CC315A_full.xml, CC315A_reduced.xml
    amendment/                 validAmendment.xml, CC313A_reduced.xml
    outcomes/                  empty — HMRC publishes none
    notifications/             empty — HMRC publishes none

  testing/
    sandbox.md                 the five simulation headers and their behaviour
    test-scenarios.md          40-scenario implementation test matrix
```

---

## What ENS is

An Entry Summary Declaration is a **safety and security** filing, made before
goods arrive, so customs can risk-assess the consignment. It is separate from
the customs declaration that clears the goods — a consignment needs both, and
FreightCode currently does only the second.

Three APIs, one scope (`write:import-control-system`):

| API | Does |
|-----|------|
| Declarations | Submit a new ENS (IE315) or amend one (IE313) |
| Outcomes | Collect the result — accepted with an MRN, or rejected |
| Notifications | Collect advanced notifications, including **Do Not Load** |

---

## Four things that will catch out an implementer

**1. A 200 is not an acceptance.** Submission is synchronous and returns a
correlation ID; the actual outcome arrives later on a different API. The MRN
only exists once an accepted outcome is collected.

**2. No simulation header, no outcome.** In sandbox, omitting
`simulateRiskingResponse` means no outcome is *ever* produced. A poller will
appear broken when it is behaving correctly. See [`testing/sandbox.md`](testing/sandbox.md).

**3. Acknowledgement is a destructive read.** `DELETE` removes the item from
HMRC's list permanently. Persist first, acknowledge second — the reverse loses
data with no way to recover it.

**4. Two of HMRC's own examples fail HMRC's own schema.** `CC315A_full.xml` and
`CC313A_reduced.xml` contain placeholder text where coded values are required.
They were left exactly as published. Use `validSubmission.xml`,
`CC315A_reduced.xml` and `validAmendment.xml` as fixtures.

---

## Ground rules

1. Files under `schemas/` and `examples/`, and every `*.md` mirror, are HMRC's.
   Do not edit them — re-download.
2. Files under `reference/raw/` and `validation/*.json` are generated. Do not
   hand-edit; regenerate from the mirror.
3. HMRC (gov.uk) overrides every other source, consistent with
   [`../specs/README.md`](../specs/README.md) §"Source policy".
4. Do not overwrite this pack on a later run. Diff first — see
   [`CHANGELOG_TRACKING.md`](CHANGELOG_TRACKING.md).
