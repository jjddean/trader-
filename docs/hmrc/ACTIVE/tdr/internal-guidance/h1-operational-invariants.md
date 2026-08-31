# H1 Operational Invariants

These rules protect the current HMRC CDS H1 submission path from accidental cleanup regressions.

## Data Rules

- Do not synthesize declaration defaults that hide missing source data.
- Do not infer CPC or additional procedure codes from unrelated fields.
- Do not invent preference `100` (DE 4/17). Missing preference fails. Explicit `100` is a real code and may emit.
- Do not invent additional procedure `000` (DE 1/11). Missing APC fails. Explicit `000` is a real code; it is forbidden with a 53-series CPC. Do not add a fabricated CPC↔APC matrix.
- Do not infer DE 6/2 from a hard-coded HS list. Requirement is `required` / `not_required` / `unknown` from `requiresSupplementaryUnit`. `unknown` fails; it is not `not_required`.
- Do not invent shipping marks `N/A` (DE 6/11) or fabricate package quantity / type. Use real marks or HMRC-prescribed values (`Unpackaged` / `Loose Bulk` / `Break Bulk`). Omit only where the category rules allow (GB supplementary Y/Z).
- Do not fill DE 4/11 from the DE 4/14 item sum. Blank omits the element. A supplied total must equal the item sum. Numeric `0` is a real value.
- Do not silently substitute invoice currency, destination country, dispatch country, importer EORI, declarant EORI, presentation office, goods location, Incoterms, or Incoterm location.
- Do not generate placeholder package blocks when package data is missing.
- Do not auto-create additional documents to make a declaration appear complete.

## Mapper Rules

- Mapper output must reflect persisted Convex declaration and goods item fields.
- Missing mapper-critical data should fail fast before live submission.
- Additional documents must pass through from saved goods item data.
- Exporter details must remain conditional; do not emit an overseas exporter as a fake GB or XI EORI.
- Government procedure mapping must preserve the DE 1/10 and DE 1/11 split.

## XML Rules

- XML element ordering is an HMRC compatibility constraint. Do not change ordering without updating golden fixtures.
- XML renderer behavior must be covered by fixture tests before refactor.
- Escaping must happen at the renderer boundary for every interpolated value.
- A live HMRC `202` without `X-Conversation-ID` is a failure state, not a success.

## Notification Rules

- HMRC notification records are audit evidence and must remain append-only.
- Do not synthesize DMS notification types for operational evidence.
- Preserve raw HMRC payloads verbatim.
- Status should derive from HMRC notification content, not manual UI assumptions.

## Change Gate

Before changing mapper, XML rendering, Convex persistence, submit routes, or notification parsing:

1. Confirm the change is based on the current baseline branch.
2. Run or add golden fixture coverage for declaration input, mapper output, XML output, and DMS parsing.
3. Confirm no invariant above is weakened.
