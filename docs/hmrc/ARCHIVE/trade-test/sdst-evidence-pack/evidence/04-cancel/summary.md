# Cancel / invalidation — evidence

## Successful invalidation (SDST §4.2)

| Field | Value |
|-------|-------|
| Date (UTC) | 2026-06-04 18:56:09Z |
| Submit LRN | FC-MPZUVPRD |
| Cancel LRN | CX-kn73a2vpts1b6j7tsfy7ct7mms832vkx |
| MRN | 26GB656DZN0FE7LAR0 |
| X-Conversation-ID (cancel) | 5a46d731-2020-4c95-810c-cc83b40d36a3 |
| HTTP submit | **202** |
| HMRC outcome | **Invalidation accepted** — **FunctionCode 02** (DMSINV), cancel LRN on response; app status **Invalid (DMSINV)** |
| XML builder | `src/lib/hmrc-invalidation-xml.ts` (CANCEL.xsd + TT_IM011a shape) |
| Reference sample | `reference-TT_IM011a_Cancellation.xml` |

### Follow-up notifications (same MRN, Trade Test)

| Time (UTC) | FunctionCode | App label | Notes |
|------------|--------------|-----------|-------|
| 18:56:06 | 11 | DMSCLE | Follow-up clearance (`response-dmscle-26GB656DZN0FE7LAR0.xml`) — `NameCode` 39, `AFB`; cancel LRN on declaration |
| 18:56:06 | **02** | **DMSINV** | **Authoritative invalidation** — `CX-…` cancel LRN (`response-dmsinv-26GB656DZN0FE7LAR0.xml`) |
| 18:56:09 | 10 | DMSDOC (UI) | `CancellationDateTime` on response — informational (`response-invalidation-26GB656DZN0FE7LAR0.xml`) |

**Do not use FC 11 as §4.2 pass/fail** — invalidation success is **FC 02** only.

Archive: `response-dmsinv-*.xml`, `response-dmscle-*.xml`, `response-invalidation-*.xml` (FC 10), `request.xml`.

---

## Earlier attempts (learning / partial)

### FC-MPYAJ7RN / 26GB63M1I0RQFCVAR4 — CDS12015

| Field | Value |
|-------|-------|
| Date (UTC) | 2026-06-04 16:14:36Z |
| HTTP | **202** |
| Outcome | **DMSREJ** — CDS12015 at `42A` / D014 (already cleared, ICS 22) |

Proves cancel route transport; not successful invalidation on that MRN.

### Other DMSREJ attempts

See `LOG.md` and `response-dmsrej-26GB651QTZ00PLSAR3.xml` (Amendment/XML iteration history).
