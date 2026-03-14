# EU Preferences Plan (Phase 1)

Goal: Add two EU preference schemes to the Global Trade Preference Engine without rewriting core logic. Ship a usable “EU mode” with deterministic calculations and auditable rule references.

## Scope (Now)
- Schemes
  - EU_EBA (Everything But Arms) — LDCs → 0% on almost all tariff lines.
  - EU_GSP_PLUS (GSP+) — enhanced preferences for qualifying countries.
- Defer Standard GSP until EBA/GSP+ are live.

## Timeline
- Week 1 — Data + Engine Wiring
  - Prepare and upload datasets to R2
  - Add scheme registry entries for EU_EBA and EU_GSP_PLUS
  - Enable EU market toggle and reuse existing calculator/compliance flow
- Week 2 — UX + Validation
  - Add “Best Available Rate” panel
  - Add compliance explanation with PSR excerpt and certificate guidance
  - Validate across 9 test cases (3 HS × 3 origins)

## Data Artifacts (Cloudflare R2)
- Paths (versioned)
  - `/tariffs/eu/vYYYY-MM/tariff_schedule.json` — TARIC rates for targeted HS scope
  - `/gsp/vYYYY-MM/tiers.json` — country → tier (EBA | GSP+), includes sources and as‑of date
  - `/gsp/vYYYY-MM/psr_excerpts.json` — HS chapter → short PSR citation/excerpt
  - `/schemes/vYYYY-MM/EU_EBA.json` — scheme registry entry
  - `/schemes/vYYYY-MM/EU_GSP_PLUS.json` — scheme registry entry

### Sample JSON Shapes

`tariff_schedule.json`
```json
{
  "asOf": "2026-04-01",
  "source": "https://ec.europa.eu/taxation_customs/dds2/",
  "rates": [
    { "hs": "610910", "destination": "EU", "mfn": 12.0, "eba": 0.0, "gspPlus": 0.0 },
    { "hs": "520811", "destination": "EU", "mfn": 8.0, "eba": 0.0, "gspPlus": 0.0 }
  ]
}
```

`tiers.json`
```json
{
  "asOf": "2026-04-01",
  "source": "EU Official Journal...",
  "EBA": ["Bangladesh", "Cambodia", "Nepal"],
  "GSP_PLUS": ["Pakistan", "Philippines"]
}
```

`psr_excerpts.json`
```json
{
  "asOf": "2026-04-01",
  "source": "Annexes to the GSP Regulation",
  "chapters": {
    "61": "Manufacture from yarn (yarn-forward). See Annex X, Note 3.",
    "52": "Manufacture from non-originating materials of heading 52.04 or 52.05."
  }
}
```

`EU_EBA.json` (scheme registry)
```json
{
  "schemeName": "EU_EBA",
  "jurisdiction": "EU",
  "countriesTier": "EBA",
  "tariffSchedulePath": "/tariffs/eu/v2026-04/tariff_schedule.json",
  "certificate": { "form": "Form A / Statement on Origin", "notes": "Supplier’s declaration rules apply." },
  "psrCoverage": "chapter_excerpts",
  "asOf": "2026-04-01"
}
```

`EU_GSP_PLUS.json` (scheme registry)
```json
{
  "schemeName": "EU_GSP_PLUS",
  "jurisdiction": "EU",
  "countriesTier": "GSP_PLUS",
  "tariffSchedulePath": "/tariffs/eu/v2026-04/tariff_schedule.json",
  "certificate": { "form": "Form A / Statement on Origin", "notes": "Domestic compliance with conventions required." },
  "psrCoverage": "chapter_excerpts",
  "asOf": "2026-04-01"
}
```

## Engine Wiring (No Core Rewrite)
- Market selector adds “EU”. Selecting EU loads scheme registry for EU_EBA and EU_GSP_PLUS.
- Calculator/Compliance use the selected scheme’s tariffSchedulePath and country tier lists.
- Best Available Rate panel compares MFN vs UK DCTS vs EU_EBA vs EU_GSP_PLUS and crowns the lawful lowest rate; display legal basis and “as‑of” date.
- Compliance explanation shows:
  - Scheme and tier
  - Certificate guidance (Form A/EUR.1/Statement on Origin)
  - PSR excerpt for the HS chapter (citation only; no AI guesses)

## UX Surfaces (Phase 1)
- Calculator: “Best Available Rate” comparison with ‘Explain rule’ link.
- Compliance: scheme badge, certificate instruction, PSR excerpt.
- Lane: “Value Uplift” badge showing duty delta vs MFN (or cashflow gains later).

## Validation Matrix (9 Cases)
- HS codes: 610910 (knit T‑shirts), 520811 (cotton woven), 090121 (coffee)
- Origins: Bangladesh (EBA), Pakistan (GSP+), Vietnam (control/non‑eligible for EU GSP+)
- Verify: MFN vs EU_EBA vs EU_GSP_PLUS vs existing UK DCTS; confirm rates and display “as‑of” dates.

## Rollout & Rollback
- Rollout: Merge scheme JSONs, enable EU toggle, release behind feature flag if needed.
- Rollback: Disable EU market selector and remove EU scheme registry entries; no data loss.

## Risks & Mitigations
- PSR complexity: Start with chapter excerpts; link to annex citations. No free‑text “interpretation”.
- Data freshness: Every artifact includes `asOf` and `source`; display in UI.
- Performance: Keep files scoped to targeted HS chapters at first; use CDN (R2 public URL).

## Done When
- EU market selectable; calculator and compliance show EU_EBA/GSP+ outcomes.
- Best Available Rate chooses a lawful scheme and cites it.
- 9 validation cases match TARIC and display “as‑of” date.

---
Owner notes: Keep datasets in versioned R2 paths. Avoid large Convex tables; store pointers + metadata only. Use existing scripts for uploads and add a short README next to data if needed.

