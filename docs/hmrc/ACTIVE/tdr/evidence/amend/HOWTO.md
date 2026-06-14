# TDR v1 — Amend (COR)

**Env:** `NEXT_PUBLIC_HMRC_ENV=tdr` · `Accept: application/vnd.hmrc.1.0+xml` · restart `npm run dev`

**API:** `POST /customs/declarations/amend` (FunctionCode 13, TypeCode COR)

## Steps

1. **Submit** a fresh declaration → wait for **DMSACC** (new MRN — do not reuse TT v2 MRNs).
2. Within **1–2 minutes** of DMSACC (before sandbox DMSCLE noise), open **Status** → **Amend** (item price COR, e.g. GBP 8000).
3. Wait for **DMSRES** (FC 07) on timeline.
4. **Pull notifications** if push missed.
5. Export raw DMSRES XML from timeline → `response-dmsres.xml`
6. Add row to [`../LOG.md`](../LOG.md)

## Freeze files

| File | Content |
|------|---------|
| `request.xml` | Amend payload (optional — from Network or submissions) |
| `response-dmsres.xml` | Raw DMSRES notification |
| `summary.md` | MRN, LRNs, conversation ID, UTC timestamps |
