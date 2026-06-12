# Fresh Trade Test submit (controlled)

Lane: `docs/hmrc/ARCHIVE/trade-test/lane.md` (HS `8471300000`, CPC `4000/000`, origin `DE`, EORI `GB553202734852`).

Read **`evidence/03-notifications/TRADE-TEST-REALITY.md`** before planning evidence — TT does not emit real **DMSCLE** on accept-only MRNs.

## Rules

- **One** live HMRC submit per run (no loops).
- **Submit proof** = DMSACC (+ DMSTAX). Do **not** wait for DMSCLE.
- Use a **separate** MRN for §4.2 cancel tests; cancel overwrites `declarations.conversationId` (pull then hits wrong conv).

---

## Captured — FC-MQ031D1B / 26GB65EJN3BYSELAR9 (2026-06-04)

| Step | Result |
|------|--------|
| Submit | DMSACC `22:44:14Z`, conv `c25b5658581e471a82022e43cd7e6ee2` |
| Cancel (same MRN) | DMSINV `23:53:57` UK, conv `385cf335-9b53-40fd-8519-ce0eaa599761`; DMSCLE same second = TT noise |
| Status | **Cancelled (DMSINV)** — usable for **§4.2**, not amend |

**Next fresh MRN** needed for §4.4 amend (must stay Accepted, not cancelled).

---

## A. Create + dry-run

1. New declaration in app.
2. **Enable documents (enriched mode)** if `WILDCARD_FORBID_ALL_DOCUMENTS`.
3. Core + items per `docs/hmrc/ARCHIVE/trade-test/lane.md`; documents **N935** + **N271** (AC).
4. Dry run → pass → one live submit.
5. Archive DMSACC XML; log submit conv in `LOG.md`.

## B. Do not

- Wait or pull for DMSCLE on an accepted-only declaration.
- Cancel the MRN you intend to amend.

## C. Separate tests

- **§4.2 cancel:** any MRN (this one qualifies — see `evidence/04-cancel/summary-26GB65EJN3BYSELAR9.md`).
- **§4.4 amend:** new submit, keep Accepted.
