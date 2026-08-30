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
| 2026-08-28 02:56 | FC-MTCD0MKQ | 26GB9HOIWTCHY31AA3 | 2 | **DMSREJ** | **CDS12070** ×2: `42A/67A/28A/64A/L016` and `42A/03A`. Outbound: TypeCode EXA, DE 5/23 `GBAUDVRDOVDVRGVM` (Name `DVRDOVDVRGVM`), header AdditionalInformation absent, RRS01 not emitted. Item AI `00400` only. |
| 2026-08-28 19:23 | FC-MTDCAFR8 | 26GB9INSQ1E5HQ9AR4 | 2 | **DMSREJ** | FunctionCode 03. FunctionalReferenceID `b7cae5cd86a9498f9a78bf995c472872`. **CDS12005** ×2: `42A/57B/R123` (`Declaration/Declarant/ID`, DE 3/18) and `42A/67A/74A/R038` (`Declaration/GoodsShipment/Importer/ID`, DE 3/16). ODS: party ID unknown or invalid. Same pointer pair as archived TT FC-MPU9NSCQ family. 74A is Importer, not Consignee (`27A`/`R015`). Outbound XML not in this log. |

---

## Amend rejections (state, not XML)

| Code | Pointer | Meaning | Action |
|------|---------|---------|--------|
| CDS12015 | 42A / D014 (`Declaration/ID`) | Declaration not in permissible state for amend/cancel | New MRN; amend while Accepted before sandbox DMSCLE |
| 2026-08-15 20:52 | FC-MSUUCU2Y | 26GB905V4M0SPHIAR0 | 1 | **DMSREJ** cancel | **CDS12015** @ `42A`/D014 — same state rejection. Exposed two app defects, see below. |

### 2026-08-15 — cancel rejection handling (app-side, not payload)

Root cause of the rejection itself is unchanged: the MRN was not in a
cancellable state. No payload fix applies. Two **application** defects surfaced:

1. `isCancellationRejected` was computed and used on the UI timeline but never
   passed to `statusAfterNotification`. A refused cancellation therefore fell
   through to the generic path and set the declaration to **"Rejected"** — wrong
   (HMRC still holds the declaration) and rank 100, so no later notification
   could correct it. **Fixed:** wired through `notifications.saveWebhook`,
   mirroring the existing amendment-rejected branch.
2. `isCancellationRejected` matched on `/CX-[a-z0-9]{10,}/`, which **cannot match
   on the CNS route**. This rejection and the archived 2026-06-04 one
   (`ARCHIVE/trade-test/.../04-cancel/dmsrej-snippet.xml`) both echo
   `FC-MSUUCU2Y` / `FC-MPYAJ7RN` in `Declaration/FunctionalReferenceID` — the
   original create LRN, because that is what we sent. See the next section.

**Root cause of the mis-detection: the CNS follow-up LRN rule.**

An earlier note here claimed HMRC echoes the original declaration reference on
cancel rejections. That was wrong. The cause is ours: `resolveFollowUpLrn`
(`src/lib/cns/follow-up.ts`) sends the **original create LRN** on CNS amendments
and cancellations, because CNS requires it. HMRC echoes back whatever we sent, so
no `CX-` ever appears on a CNS follow-up. Direct-HMRC follow-ups do mint `CX-`,
and the old predicates worked there. The bug was transport-specific and invisible
on the direct path.

**Detection now keyed on the originating operation.**

`notifications.originatingOperation` records which request each notification
answers. `saveWebhook` resolves it two ways:

1. `submissions.by_conversationId` — HMRC issues a distinct X-Conversation-ID per
   request, verified in production TDR data (one declaration shows submit
   `1fc754d3…` / cancel `231a6ee0…`, another submit `b8eedd1e…` / amend
   `341f8fa8…`).
2. Falling back to the declaration being in **"Cancellation Requested"** at
   ingest. CNS follow-ups record no conversationId at all — the CSP returns only
   `X-CSP-ID` — so (1) cannot work for exactly the declarations that need it.
   `declarations.beginFollowUp` sets that status atomically before dispatch and
   releases it only on a definite outcome, so nothing else can produce it.

**(2) is an INFERENCE about our own state machine, not a documented HMRC rule.**
HMRC's end-to-end guide says only that a Conversation ID "can be used to identify
notifications that correspond to this particular declaration"; the Developer Hub
API pages are behind sign-in. No HMRC citation is claimed for it.

`isCancellationRejected` and `isInvalidationAccepted` both consult the field, so a
refused cancellation no longer becomes "Rejected" (rank 100, uncorrectable) and an
accepted one is no longer shown as a validation failure.

Historical rows keep whatever they were classified as. One TDR test declaration
(`26GB905V4M0SPHIAR0`) remains stored as "Rejected"; it has no operational
consequence and was deliberately left rather than repaired by inference.

Source: `src/lib/cds_error_codes.ts` (CDS12015 description); archive `evidence/04-cancel/HOWTO.md`; `convex/lib/cds_wco_references.ts` row D014 = `Declaration/ID`.

---

## Error groups

See `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` §5.
