# Trader App

Operational customs declaration app for HMRC CDS H1 submission work.

## Current Safety Rule

Do not use stale planning notes as implementation authority. HMRC-related documentation is separated by authority level:

- `documentation/HMRC/source-material/` contains untouched official source material only.
- `documentation/HMRC/internal-guidance/` contains current project interpretations and operational rules.
- `documentation/archive/` contains stale notes, generated artefacts, and superseded plans. Archive files are preserved for context but are not authoritative.

Before changing mapper, Convex persistence, HMRC submission, XML rendering, or notification behavior, read `documentation/HMRC/internal-guidance/h1-operational-invariants.md`.
