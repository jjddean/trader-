# ENS error codes

**Status:** ACTIVE — reference data only

> Derived from the two HMRC Level 2 validation pages mirrored in this directory.
> Machine-readable index: [`error-codes.json`](error-codes.json)
> Full rules with verbatim conditions: [`business-rules.json`](business-rules.json)
> Retrieved: 2026-08-22

---

## Bands

HMRC states the split explicitly on the Level 2 validation page:

| Range | Layer | Produced by |
|-------|-------|-------------|
| 4000–4999 | XML schema validation | Body checked against `CC315A` / `CC313A` |
| 8000–8999 | Business rule validation | Level 2 rules |

Both return **HTTP 400** with an `errorresponse` body listing every error found.

> "No outcome will be available for a submission with validation errors."

That sentence is load-bearing. A submission that fails either layer never
produces an outcome, so a poller waiting on one will wait indefinitely.

---

## Counts

| | |
|--|--|
| Distinct error codes | **182** |
| Rules for IE315 (new ENS) | 188 |
| Rules for IE313 (amendment) | 187 |
| Codes appearing in both messages | 181 |

Because 181 of 182 codes are shared, the validation engine should be written
once and parameterised by message type rather than duplicated. The context
element differs — `/CC315A/...` versus `/CC313A/...` — but the condition is the
same rule.

---

## Structure of a rule

Each entry in `business-rules.json`:

```json
{
  "errorCode": "8103",
  "contextElement": "/CC315A/GOOITEGDS",
  "scenario": "[Gross mass] should be present if not ([Specific circumstance indicator] eq 'E' or [Total gross mass])."
}
```

| Field | Meaning |
|-------|---------|
| `errorCode` | The code HMRC returns in `errorresponse` |
| `contextElement` | Absolute XML path the rule applies at — use this to attach the error to a field |
| `scenario` | HMRC's condition, **verbatim** |

`scenario` is copied character-for-character and must stay that way. Conditions
like the one above carry precedence and negation that do not survive being
reworded, and the exact text is what an operator will match against an HMRC
rejection.

---

## Using this to build validation

1. Load `business-rules.json`, filter by message type.
2. Map `contextElement` to the FreightCode field via `../reference/raw/fields.json`.
3. Implement the condition from `scenario`. Where a condition cannot be
   mechanically expressed, record it as deferred with a reason — never drop it
   silently.
4. Surface the HMRC `errorCode` alongside the FreightCode message, so a
   rejection can be traced back to the rule.

Point 4 mirrors what the CDS side already does with `src/lib/cds_error_codes.ts`
and DE numbers: the operator reads a code from HMRC and needs to find the field
it refers to.

---

## Not captured

Schema-layer codes (4000–4999) are not individually enumerated by HMRC as a
list — they arise from the XSD. Only one appears in the Level 2 pages (4065,
message sender pattern). The authoritative source for that layer is the schema
itself: `../schemas/declarations/CC315A-v11-2.xsd` and `CC313A-v11-2.xsd`, both
of which compile locally and can validate a document directly.
