# Cancel — how to test

**API:** `POST /customs/declarations/cancellation-requests` with **FunctionCode 13**, **TypeCode INV** (invalidation).

**Schema:** HMRC `CANCEL.xsd` — no `<Declarant>`; use `<Submitter><ID>EORI</ID></Submitter>`. See `src/lib/hmrc-invalidation-xml.ts`.

## In the app

1. Open a declaration that has an **MRN** and status **Accepted** (e.g. FC-MPYAJ7RN / `26GB63M1I0RQFCVAR4`).
2. **Customs Status Timeline** → red **Cancel** button.
3. Confirm → enter reason (default: `Declaration is no longer required`) — sent as AES text in XML.
4. On success: green **Cancel OK** + conversation ID in the message.

## CDS12015 on cleared MRN (FC-MPYAJ7RN)

HTTP **202** only means HMRC **received** the invalidation XML.  
**DMSREJ + CDS12015** at `42A`/D014 = MRN exists but **state does not allow cancel** (this lane was ICS 22 / goods released).

That is **not** a bug in your reason text or EORI format.

## Successful cancel evidence

1. Submit a **new** declaration (dry-run → one submit).
2. Cancel **that** MRN while status is still **Accepted** (before clearance).
3. Save notification + XML here.

## Save evidence here

- [ ] `summary.md` — date, LRN, MRN, conversation ID, HTTP status
- [ ] `request.xml` — copy from Network tab or API response `requestXml` if returned
- [ ] `response.xml` — HMRC response body from Network tab
- [ ] Row in `LOG.md`

## Pull notification

After cancel, use **Pull notifications** or wait for push — look for invalidation-related DMS* on the conversation ID.
