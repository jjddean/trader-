# Amend — how to test (SDST §4.4)

**API:** `POST /customs/declarations` with **FunctionCode 13** and the **MRN** in `<ID>` (same endpoint as submit; not a separate `/amend` path in Trade Test v2.0).

**Builder:** `src/lib/hmrc-amendment-xml.ts` + `src/app/api/hmrc/amend/route.ts` — **TypeCode COR** (not IMA), with `AdditionalInformation` + `Amendment` pointers (HMRC `TT_IM002b`).

## Before you amend

1. Declaration must have an **MRN** and status **Accepted** (not cancelled / DMSINV).
2. On **Goods Items**, change **item value** (DE 4/14) — the app amends `ItemChargeAmount` with ChangeReasonCode `21`. Use a **higher** value than accepted (e.g. `5000` → `5500`) — lowering value often triggers **CDS13000** smart rejection on the amend message.
3. Run dry-run if you changed mapper fields: `node test-evidence/run-hmrc-scenarios.js`.

## In the app

1. Open the declaration with MRN (e.g. fresh submit — **not** an MRN you already cancelled).
2. **Customs Status Timeline** → **Amend** (shown when status is **Accepted**).
3. Confirm → on success: green message with **conversation ID**; status becomes **Amendment Processing**.
4. **Pull notifications** (same conversation as amend response, or submit conversation if HMRC links by MRN).
5. Look for HMRC response notifications (accept/reject of the amendment message).

## Reference XML shape

See `reference-TT_IM002b_Amendment.xml` (official HMRC sample) — FunctionCode 13, TypeCode **COR**, AES reason, Amendment pointers, minimal `GoodsShipment` fragment.

## Save evidence here

- [ ] `summary.md` — date, submit LRN, MRN, amend conversation ID, outcome (DMSACC / DMSREJ / etc.)
- [ ] `request.xml` — amend payload sent
- [ ] `response.xml` or notification XML — HMRC async notification
- [ ] Row in `LOG.md`

## Common outcomes

| Signal | Meaning |
|--------|---------|
| HTTP **202** | Amendment message received by CDS (await notification) |
| **DMSREJ** + CDS codes | Amendment XML or data failed business rules |
| HTTP **400** | XSD / schema order — fix XML builder before resubmitting |

## Do not use for §4.4 evidence

- Amend on **cleared** MRNs without a fresh accepted declaration.
- MRNs already **invalidated** (cancel success = DMSINV FC 02).
