# GB dual-use pilot evidence audit — 11 July 2026

## Outcome

The three pilot manufacturer sources are now archived locally and SHA-256 recorded in
`data/export-controls/candidates/pilot-source-archive-manifest.json`.

- SIMX: current manufacturer page archived; all stored quotations verified.
- Cordin 560: manufacturer PDF already archived and hashed.
- SIR3: original 2024 brochure URL now returns HTTP 404. The URL remains preserved in the
  candidate record. The manufacturer's current 2026 successor brochure is archived and
  contains the stored SIR3 quotations.

## Open audit finding: SIR3

The current manufacturer brochure states:

- "100μs minimum delay between 2 images"
- "Delay to 2nd Image 100µS – 10mS in 5ns steps."

This appears to supply decisive timing evidence that was previously treated as missing.
A 100 μs minimum inter-image delay corresponds to 10,000 image intervals per second,
below the strict thresholds in both `6A003.a.4` (>1,000,000 frames/s) and `6A203.b.1`
(>225,000 frames/s).

The existing `CANNOT_DETERMINE` result has not been silently changed. Before seed-batch
generation continues, the SIR3 record must be reassessed deterministically against the
tested entry and plausible neighbouring entries, then run through local and Dedalus
validation. Consultant fields must remain null.

## Gate decision

Do not expand into the 25-record seed batch while this pilot finding remains unresolved.
The next bounded task is the SIR3 reassessment; it requires no OpenAI request because the
decisive primary evidence is now archived locally.
