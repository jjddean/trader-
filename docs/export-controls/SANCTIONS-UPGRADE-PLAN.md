# Sanctions Screening Upgrade Plan

**Status:** ACTIVE — staged implementation. Complete one part at a time and verify its exit criteria before starting the next part.

## Current baseline

The application already has:

- UK Sanctions List parsing and normalized snapshot types
- deterministic matching for names, addresses, countries, dates of birth and identifiers
- block, review, show and ignore score bands
- assessment-level screening records and human confirm/dismiss review
- snapshot version and 48-hour freshness metadata
- unit tests for parsing, canonicalisation, scoring and matching

The end-to-end data pipeline is incomplete. The R2 upload is not automatically registered as the active `sanctions_list` reference dataset, the advertised npm scripts are missing, the sanctions check is not scheduled, and the local fallback snapshot is absent.

---

## Part 1 — Make UK screening operational

Goal: make the existing UKSL feature reliable without adding another data provider.

### Work

- Add package scripts:
  - `export-controls:ingest-sanctions`
  - `export-controls:upload-sanctions`
  - `export-controls:refresh-sanctions`
  - `test:sanctions`
- Make refresh perform one complete operation:
  1. fetch official UKSL XML
  2. parse and validate it
  3. write a versioned JSON snapshot
  4. upload versioned and `latest.json` objects to R2
  5. record `sanctions_versions`
  6. update the active `referenceDatasets` row named `sanctions_list`
- Remove the hard-coded fallback filename. Resolve the newest local snapshot dynamically.
- Allow local fallback when the dataset row is missing, not only after an R2 fetch fails.
- Register the daily sanctions check in `convex/crons.ts`.
- Add an authenticated admin/manual refresh path or documented CLI runbook.
- Show a clear unavailable/stale message instead of a generic HTTP 500.
- Add a health query showing source version, last ingest, age, entity count and active storage URL.

### Keys/configuration

No sanctions-provider key is required.

Required for hosted snapshots:

- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `NEXT_PUBLIC_R2_PUBLIC_URL`

Existing Clerk and Convex configuration remains required for authenticated screening.

### Exit criteria

- A fresh deployment can run one command and produce a usable UKSL snapshot.
- The Sanctions tab screens an assessment without manual database edits.
- The active dataset and freshness metadata agree.
- A stale or failed refresh blocks clearance and gives an actionable error.
- Parser, scoring, route and refresh tests pass.

Stop after Part 1 and verify in development before continuing.

---

## Part 2 — Screen every relevant party

Goal: expand assessment coverage and improve the review record.

### Work

- Screen exporter, consignee, end user, intermediary and vessel when present.
- Capture and pass stronger identifiers:
  - date of birth
  - passport or national identifier
  - company registration number
  - IMO number for vessels
  - address and country
- Display which fields contributed to each match score.
- Store the matched name/alias, regime, measures and source version with the screening record.
- Require a review note when confirming or dismissing a material match.
- Record reviewer, timestamp and reason in the immutable assessment audit trail.
- Invalidate or mark a screening stale when a screened party changes.
- Add a `re-screen required` state when the official list version changes.
- Separate `no matches found` from `screening not run` and `screening unavailable`.

### Exit criteria

- All populated party types are screened in one action.
- Users can explain why a result matched and who resolved it.
- Changing a party or dataset cannot leave an old result appearing current.
- Assessment sign-off refuses missing, stale or unresolved screening.

Stop after Part 2 and review false positives with realistic cases.

---

## Part 3 — Accuracy, performance and operational controls

Goal: make UK screening defensible at production volume.

### Work

- Build a larger anonymised evaluation corpus with known matches, aliases and near misses.
- Measure precision and recall for individuals, entities and ships separately.
- Tune thresholds from evidence rather than fixed assumptions.
- Treat weak aliases differently from primary names and strong aliases.
- Add transliteration and token-order tests for non-Latin names.
- Precompute normalized names and identifiers during ingestion.
- Avoid rebuilding the full in-memory index for every request; add a version-keyed cache.
- Replace the reused AI-classification rate limiter with a sanctions-specific limiter.
- Add structured refresh and screening logs without storing unnecessary personal data.
- Alert when refresh fails, snapshots become stale, entity counts change unexpectedly or parsing loses required fields.
- Document retention, access control and data-protection rules for screening records.

### Exit criteria

- Thresholds have recorded test evidence.
- Screening latency is acceptable at the expected assessment volume.
- Refresh failures generate an operational alert.
- Access, retention and audit behaviour are documented and tested.

Stop after Part 3. UK screening is the production baseline.

---

## Part 4 — Optional free international lists

Goal: add international coverage only when the product scope requires it.

### Priority sources

1. **UN Security Council Consolidated List**
   - official XML download
   - no API key
   - individuals and entities under UN Security Council measures

2. **US OFAC Sanctions List Service**
   - official downloadable SDN and consolidated non-SDN data
   - no commercial API key for published files
   - automated requests must send an appropriate `User-Agent`

3. **EU consolidated financial sanctions data**
   - evaluate the current official distribution format and access conditions before implementation
   - do not use an unofficial mirror as the authoritative source

### Architecture

- Add a source adapter per authority.
- Normalize into a common entity model while preserving source-specific identifiers and measures.
- Never collapse conflicting records without retaining provenance.
- Display which lists were screened and their versions.
- Let policy decide which sources apply to an assessment; do not imply every list has the same legal effect.
- Deduplicate likely cross-list entities for presentation without hiding individual source hits.

### Exit criteria

- Each list has parser fixtures, live-fetch checks and change detection.
- Results retain authority, list, regime, source identifier and version.
- The UI clearly distinguishes UK, UN, US and EU results.
- Legal/product wording accurately describes coverage.

Stop after each new source. Add one authority at a time.

---

## Part 5 — Optional identity enrichment

Goal: reduce false positives by verifying counterparties with free or existing registries.

### Candidates

- Companies House API for UK company identity (an API key already exists in project configuration)
- GLEIF LEI data/API for legal-entity identifiers
- VIES for EU VAT-number validation where applicable

### Rules

- Enrichment supports identity resolution; it does not replace sanctions screening.
- Keep registry data and sanctions decisions separate.
- Record the source and retrieval time of enrichment evidence.
- Do not silently dismiss a sanctions result because a registry match differs.

### Exit criteria

- Enrichment measurably reduces ambiguous entity matches.
- Users can see the evidence and source used.
- No automated dismissal is introduced.

---

## Part 6 — Optional commercial screening provider

Goal: consider a paid provider only after usage and risk justify it.

### Evaluate later

- OpenSanctions API/datasets
- ComplyAdvantage
- Dow Jones Risk & Compliance
- LSEG/World-Check
- LexisNexis screening products

### Required evaluation

- list coverage and update latency
- beneficial ownership, PEP and adverse-media coverage
- matching explainability
- audit evidence and data retention
- licensing restrictions on cached data
- UK/EU data residency and sub-processors
- price per screening and rescreen
- webhook/change-notification support
- fallback and provider-outage behaviour

### Decision gate

Do not add a paid provider merely to duplicate UKSL. Add one only if customers require broader jurisdictions, PEP/adverse-media screening, ownership resolution, continuous monitoring or a vendor-backed compliance SLA.

---

## Recommended implementation order

1. Part 1 — repair UK data pipeline
2. Part 2 — complete party coverage and review workflow
3. Part 3 — accuracy and production hardening
4. Part 4 — add one free international authority if required
5. Part 5 — add identity enrichment if false positives justify it
6. Part 6 — evaluate paid providers only with demonstrated demand

## Source references

- UK Sanctions List: https://www.gov.uk/government/publications/the-uk-sanctions-list
- UKSL format guide: https://www.gov.uk/guidance/format-guide-for-the-uk-sanctions-list
- UN Security Council Consolidated List: https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list
- OFAC Sanctions List Service: https://ofac.treasury.gov/sanctions-list-service

