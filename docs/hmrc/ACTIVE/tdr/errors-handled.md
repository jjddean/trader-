# TDR DMSREJ — Freightcode

Record every TDR rejection here (v1.0 Declarations, production host).

TT history (archive only): `docs/hmrc/ARCHIVE/trade-test/errors-handled.md`

---

## Submissions

| Date (UTC) | LRN | MRN | Error count | Outcome | Notes |
|------------|-----|-----|-------------|---------|-------|
| 2026-06-10 20:15 | FC-MQ8IDIYS | 26GB6DTVT5133M7AR0 | 0 | **DMSACC** | TDR v1 sandbox (`Accept: application/vnd.hmrc.1.0+xml`). Advisory CDS13000 only. X-Conversation-ID `c493713d-b599-421c-8283-f182a1e7d275`. Freeze: `evidence/passing-payload.xml`. |
| 2026-06-11 23:28 | AM-jpyv90jb…-0FIFPK | 26GB6F8QX9AC62SAR0 | 1 | **DMSINV** amend | **CDS12015** @ `42A`/D014 — MRN not amendable (DMSCLE / cleared state). Not payload. Use fresh submit → amend before clearance. |
| 2026-06-11 23:33 | AM-jpyv90jb…-9GXS8B | 26GB6F8QX9AC62SAR0 | 1 | **DMSINV** amend | Same **CDS12015** — MRN dead; stop retrying this MRN. |

---

## Amend rejections (state, not XML)

| Code | Pointer | Meaning | Action |
|------|---------|---------|--------|
| CDS12015 | 42A / D014 (`Declaration/ID`) | Declaration not in permissible state for amend/cancel | New MRN; amend while Accepted before sandbox DMSCLE |

Source: `src/lib/cds_error_codes.ts` (CDS12015 description); archive `evidence/04-cancel/HOWTO.md`; `convex/lib/cds_wco_references.ts` row D014 = `Declaration/ID`.

---

## Error groups

See `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` §5.
