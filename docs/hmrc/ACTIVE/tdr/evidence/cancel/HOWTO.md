# TDR v1 — Cancel (invalidation)

**Env:** `NEXT_PUBLIC_HMRC_ENV=tdr` · `Accept: application/vnd.hmrc.1.0+xml` · restart `npm run dev`

**API:** `POST /customs/declarations/cancellation-requests` (FunctionCode 13, TypeCode INV)

## Steps

1. **Submit** a fresh declaration → **DMSACC** (use a **different** MRN from amend test).
2. While status is **Accepted**, **Cancel** from Status page (before clearance).
3. Wait for **DMSINV** (FC 02).
4. Export raw DMSINV XML → `response-dmsinv.xml`
5. Add row to [`../LOG.md`](../LOG.md)

## Freeze files

| File | Content |
|------|---------|
| `request.xml` | Cancel payload (optional) |
| `response-dmsinv.xml` | Raw DMSINV notification |
| `summary.md` | MRN, submit LRN, cancel LRN, conversation ID, UTC |
