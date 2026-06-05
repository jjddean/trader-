# SDST evidence pack

**Only folder for production sign-off.** Open **[CHECKLIST.md](./CHECKLIST.md)** and tick items. Log each test in **[LOG.md](./LOG.md)**. Return **`forms/CDS-Production-Checklist-v1.2-FILLED.odt`** to SDST (regenerate: `node test-evidence/fill-cds-odt.js`). Manual reference: **[ODT-FILL-GUIDE.md](./ODT-FILL-GUIDE.md)**.

## Done

- Submit: `evidence/02-submit/` — DMSACC, 0 blocking errors (`scenario-1-happy-path.md`)
- Cancel: `evidence/04-cancel/` incl. `26GB65EJN3BYSELAR9` — **DMSINV** = success; DMSCLE after cancel = TT noise (`TRADE-TEST-REALITY.md`)
- Amend: `evidence/05-amend/` — `26GB664W3BLIFZFAR4`, DMSRES FC07
- Notifications: `evidence/03-notifications/`
- Status query: `evidence/07-status-query/`
- File upload initiate: `evidence/06-file-upload/` — HTTP 200, conv `e8aba099-…`

## Next (in order on CHECKLIST.md)

1. Fill `evidence/01-application-details.md` → ODT §1–§3
2. Return `forms/CDS-Production-Checklist-v1.2.odt` to SDST
3. `08-pull-notifications/` — optional (push already proven)

## Layout

```
CHECKLIST.md     ← work here
LOG.md
forms/           ← ODT for SDST
evidence/
  01-application-details.md
  02-submit/     ← done
  03-notifications/
  04-cancel/ … 08-pull-notifications/  ← pending (see EVIDENCE.md in each)
```

Code/spec (`spec/passing-payload.xml`, `run-hmrc-scenarios.js`) unchanged — not part of this pack.
