# Laptop lane rejection archive (HS 8471300000)

DMSREJ history for the active Felixstowe lane is recorded in `docs/hmrc/ARCHIVE/trade-test/errors-handled.md` (LRNs `FC-MPO*` through `FC-MPY9FFEE`).

Standalone DMSREJ request/response XML files were **not** persisted for most app submits (only HTTP 202 + async notifications). Pre-lane artefacts remain under `test-evidence/archive-pre-p0/`.

**Passing submit:** `FC-MPYAJ7RN` → MRN `26GB63M1I0RQFCVAR4` (DMSACC 2026-06-03). Baseline XML: `docs/hmrc/ARCHIVE/trade-test/passing-payload.xml` and `docs/hmrc/ARCHIVE/trade-test/evidence/passing/`.
