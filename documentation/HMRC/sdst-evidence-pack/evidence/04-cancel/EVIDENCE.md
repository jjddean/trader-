# Cancel — `POST /customs/declarations/cancellation-requests`

**Checklist:** [CHECKLIST.md](../../CHECKLIST.md) §4.2

## When complete, add here

- [ ] `summary.md` — date, LRN, MRN, conversation ID, HTTP status, notification type (e.g. DMSINV)
- [ ] `request.xml` — cancellation payload (FunctionCode 13 + TypeCode INV)
- [ ] `response.xml` — HMRC response body

## Test notes

Use a **fresh** declaration or an MRN HMRC allows to cancel in Trade Test. Log the run in [LOG.md](../../LOG.md).
