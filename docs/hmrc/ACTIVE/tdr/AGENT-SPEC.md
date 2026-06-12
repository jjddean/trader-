# Freightcode HMRC Agent Spec (Canonical)

**This is the only document that defines HMRC/CDS behaviour for this codebase.**

---

## 0. SYSTEM PURPOSE

This codebase implements HMRC CDS customs declaration workflows (H1) with strict compliance across:

- **TDR** — active execution environment
- **Trade Test** — archived (read-only reference)
- **Production** — future (not active)

This system MUST prioritise correctness, determinism, and spec-backed behaviour.

---

## 1. SOURCE OF TRUTH (HARD AUTHORITY ORDER)

All decisions MUST follow this precedence:

1. `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` — this file (behaviour)
2. `docs/hmrc/ACTIVE/tdr/mapping/` — DE mapping data
3. `docs/hmrc/specs/` — HMRC official references (read-only data)
4. `docs/hmrc/ARCHIVE/` — Trade Test legacy (debug only; **never** for implementation)
5. External inference / memory — **NOT ALLOWED** for validation decisions

If a rule is not found in (1)–(3), STOP and request source.

---

## 2. ENVIRONMENT (SINGLE TRUTH)

```
ACTIVE ENVIRONMENT:  TDR (v1.0 Declarations, production API host api.service.hmrc.gov.uk)
ARCHIVED:            Trade Test v2.0 (read-only — docs/hmrc/ARCHIVE/trade-test/)
FUTURE:              CDS Live / Production (docs/hmrc/FUTURE/production/)
```

- TDR is the **only** active execution environment
- All validation, mapping, and submission logic MUST align to TDR rules
- Trade Test MUST NOT influence active logic
- API versions and Accept headers: `docs/hmrc/ACTIVE/tdr/environment-matrix.md`

---

## 3. NO GUESSTIMATES RULE (STRICT)

You MUST NOT:

- guess HMRC field meaning
- infer CDS rules from patterns
- assume API behaviour
- reuse Trade Test logic in TDR

Every field must map to `docs/hmrc/ACTIVE/tdr/mapping/` or `docs/hmrc/specs/`.

If mapping is missing → STOP.

**Inference exception:** Only when the user explicitly approves inference for a specific DE. Document as `INFERENCE` in the relevant `docs/hmrc/ACTIVE/tdr/mapping/de-*.md` with DMSREJ/XSD evidence — never claim HMRC citation.

**Citation rule:** Before stating how the codebase behaves on HMRC paths, read the relevant file in this session. No citation, no rule.

---

## 4. MINIMAL VALID DECLARATION RULE

Always construct smallest valid declaration for TDR:

**DEFAULT BASE:**

- 1 goods item (DE 68A)
- 1 document (DE 70A)
- Invoice only (N935)

**DO NOT add** additional documents, authorisations, preference claims, or procedural extras unless required by TDR mapping or DMSREJ.

**NEVER PATCH — ALWAYS REBUILD:** Do not modify existing payloads. Generate fresh. Old payloads are contaminated.

---

## 5. ERROR HANDLING LOOP

On rejection:

1. Log in `docs/hmrc/ACTIVE/tdr/errors-handled.md`
2. Classify root cause (one category only):
   - schema mismatch / XSD
   - missing field
   - invalid code
   - mapping error
   - documents (CDS11004, CDS77002)
   - goods location DE 5/23 (CDS10001, CDS12099, CDS12070)
   - parties / country linkage (CDS12073, CDS12056, CDS12005)
3. Fix ONLY that category
4. Resubmit

NO multi-fix bursts. If error count increases → revert → last known working structure.

**DMSREJ response format (mandatory):**

1. Root cause (max 5 bullets)
2. Fix applied (exact fields changed)
3. Updated payload
4. Expected CDS outcome

---

## 6. SCHEMA & DATA RULES

- All indexes, keys, and mappings MUST match TDR schema definitions
- No schema field without HMRC reference or confirmed TDR requirement
- No idempotency assumptions without schema support
- No dedupe logic without index backing

---

## 7. XML / MAPPER RULES

Before modifying `wco-mapper.ts` or `h1-xml-renderer.ts`:

- Read `docs/hmrc/ACTIVE/tdr/mapping/de-*.md` for the DE being changed
- Cite spec section + HMRC URL + retrieval date in changes

Never: hardcode DE mappings, reuse Trade Test XML structure, infer WCO structure.

**GovernmentProcedure encoding (DE 1/10 / DE 1/11):**

- DE 1/10: TWO `<GovernmentProcedure>` — `<CurrentCode>` = first 2 chars, `<PreviousCode>` = chars 3–4
- DE 1/11: separate `<GovernmentProcedure>` — `<CurrentCode>` = 3-char additional procedure code
- Example `4000` + `000`:
  ```xml
  <GovernmentProcedure><CurrentCode>40</CurrentCode><PreviousCode>00</PreviousCode></GovernmentProcedure>
  <GovernmentProcedure><CurrentCode>000</CurrentCode></GovernmentProcedure>
  ```

**DE 5/23:** `src/lib/goods-location.ts` splits Appendix 16C codes — see `docs/hmrc/ACTIVE/tdr/mapping/de-5-23-goods-location.md`

---

## 8. EVIDENCE RULE

| Phase | Path |
|-------|------|
| TDR (active) | `docs/hmrc/ACTIVE/tdr/evidence/` |
| Trade Test (archive) | `docs/hmrc/ARCHIVE/trade-test/evidence/` |

Freeze TDR DMSACC request XML in `docs/hmrc/ACTIVE/tdr/evidence/`.

---

## 9. DOCUMENT & LANE DISCIPLINE

- DE 2/3: each document code must have Appendix 5A row; Union before National; status only where 5A permits — see `docs/hmrc/ACTIVE/tdr/mapping/de-2-3-documents.md`
- 68A: valid commodity, procedure, origin DE 5/15 mandatory, weight > 0, value > 0, packaging
- Header: declarant/importer EORI, LRN, DE 5/23, 5/14, 5/8 — see `docs/hmrc/ACTIVE/tdr/mapping/de-3-x-parties.md`, `de-5-23-goods-location.md`
- Appendix 16C: Felixstowe = `GBAUFXTFXTFXT` — verify `docs/hmrc/specs/cds-api/mirrors/appendix-16c-maritime.psv`

---

## 10. OPERATIONAL SAFETY

**Always:**

- Use `fetchHmrc()` for every HMRC call
- `xmlEscape()` every XML value
- Derive declaration status from HMRC notifications only
- Log `X-Conversation-ID`; store on declaration after submit
- Run dry-run preflight before TDR submit

**Never:**

- Push to main without review
- Assume HMRC behaviour without citation
- Mix TT and TDR logic or Accept headers
- Delete archived Trade Test data
- Inject synthetic DMS* notifications
- Submit in automated loops (>5 per session)
- Use TDL EORIs in TDR (real declarant account data required)
- Use `ExportCountry.ID = "GB"` on imports from overseas

---

## 11. SYSTEM BEHAVIOUR PRINCIPLE

This system is: spec-driven, rejection-driven, deterministic.

This system is NOT: heuristic AI, probabilistic classifier, inference-based.

---

## 12. FILE INDEX (data — not behaviour)

| Data | Path |
|------|------|
| Environment matrix | `docs/hmrc/ACTIVE/tdr/environment-matrix.md` |
| DE mapping | `docs/hmrc/ACTIVE/tdr/mapping/` |
| DMSREJ log | `docs/hmrc/ACTIVE/tdr/errors-handled.md` |
| HMRC mirrors | `docs/hmrc/specs/` |
| TT archive | `docs/hmrc/ARCHIVE/trade-test/` |
| Production (future) | `docs/hmrc/FUTURE/production/` |

---

END OF SPEC
