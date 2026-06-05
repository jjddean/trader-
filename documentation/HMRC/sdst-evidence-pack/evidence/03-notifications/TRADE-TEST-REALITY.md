# Trade Test v2.0 — what notifications actually do

**Source:** Live TT runs in this repo (`spec/lane.md`, `test-evidence/passing/notification-audit-FC-MPYAJ7RN.md`, cancel evidence `evidence/04-cancel/`).

## Submit success (§4.1)

On a valid lane you should see:

| Signal | Meaning for SDST |
|--------|------------------|
| **DMSACC** (FC `01`) | Declaration accepted — **primary submit proof** |
| **DMSTAX** (FC `13`) | Tax/duty notification — normal in TT |
| **CDS13000** in DMSACC payload | Advisory smart error — **non-blocking** |

**Do not expect DMSCLE** on an MRN that stays **Accepted** only. `spec/lane.md` documents: *DMSCLE not on this MRN* for the passing lane.

## Cancel success (§4.2)

After invalidation (HTTP 202 on cancel):

| Signal | Use for evidence? |
|--------|-------------------|
| **DMSINV** (FC `02`) | **Yes** — invalidation accepted |
| **DMSCLE** (FC `11`) | **No** — TT lifecycle noise after cancel (same second as DMSINV); app labels this explicitly |
| **DMSDOC** (FC `10`) | Informational only |

## Pull notifications (§5)

- Uses **Pull Notifications API v1.0** (`src/lib/hmrc-pull-notifications.ts`).
- Status page passes `declarations.conversationId`, which is **overwritten** by cancel / status-query / amend — not the submit conversation.
- v2 submit conversations often return **empty unpulled list** or fail list (code returns `saved: 0` without crashing).
- **Push webhooks** already delivered DMSACC/DMSTAX; pull is a fallback, not a way to “get” DMSCLE on accept.

## SDST checklist mapping

| Checklist item | TT evidence to use |
|----------------|----------------------|
| §4.1 Submit | DMSACC + 0 blocking CDS errors + request XML |
| §4.2 Cancel | DMSINV (FC 02) on a dedicated cancel test MRN |
| “Goods cleared” journey | **Not** TT-realistic on accept-only MRNs; do not block pack on DMSCLE after submit |
