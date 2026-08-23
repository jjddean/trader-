# Can FreightCode be a warehousekeeper's Duty Management System?

**Status:** ACTIVE — research finding, no implementation

> Sources, all retrieved 2026-08-23:
> - [Duty management and closing stock balance systems](https://www.gov.uk/guidance/special-procedure-customs-warehousing/duty-management-and-closing-stock-balance-systems) — mirrored at [`system-requirements.md`](system-requirements.md)
> - [Applying to be approved as a warehousekeeper](https://www.gov.uk/guidance/special-procedure-customs-warehousing/applying-to-be-approved-as-a-warehousekeeper) — mirrored at [`../authorisation/warehousekeeper.md`](../authorisation/warehousekeeper.md)
> - Handbook updated by HMRC 30 April 2025

This is the question the task flagged as critical, and the answer changes what
building this module means.

---

## The short answer

**CDS approval does not make FreightCode an approved customs warehouse stock
system. They are unrelated approvals.**

HMRC states plainly:

> "Software that has not been approved by HMRC cannot be used."

and

> "A duty management system that cannot meet the above requirements will not be
> approved for customs warehousing purposes."

---

## Per product, or per authorisation?

**Per warehouse authorisation.** There is no product certification scheme, no
register of approved DMS vendors, and no HMRC software-testing programme for
this the way there is for CDS.

The evidence:

1. The applicant — the warehousekeeper, not the vendor — supplies **"inventory
   records with screenshots of the Warehouse Management System (WMS) or Duty
   Management System (DMS)"** as part of their authorisation application.
2. HMRC directs questions about whether a system qualifies to the
   **supervising office**, identified in the warehousekeeper's own
   authorisation letter: *"For further advice on whether duty management
   software system meets the requirements, contact the supervising office."*
3. Approval conditions are written as things the warehousekeeper must
   demonstrate about their arrangements, not properties of a product.
4. **"The responsibility and accuracy of the system lies with the
   warehousekeeper."**

So FreightCode cannot be approved in the abstract. Each customer gets it
approved as part of their own authorisation, and FreightCode's job is to make
that approval easy to obtain and impossible to lose.

That is a product requirement in itself: every customer's supervising office
will ask the same questions, so the evidence pack should be a feature, not a
support ticket.

---

## What the supervising office reviews

From the authorisation application list, the parts a stock system must satisfy:

| Required at application | What FreightCode must be able to produce |
|-------------------------|------------------------------------------|
| Written procedures for goods entering and leaving, in order | Derivable from the movement ledger, but the prose is the customer's |
| **Screenshots of the WMS or DMS inventory records** | Screens that show current stock under procedure, receipts, removals, balances |
| Type of accounting system used | A statement of how FreightCode maintains the stock account |
| How goods will be identified in the warehouse | Location and identification fields on the stock lot |
| Commodity codes (6+ digits) intended to be stored | Per-warehouse permitted commodity list |
| List of customs procedure codes intended to be used | Per-warehouse permitted procedure list |
| Whether simplified declaration procedures will be used | EIDR/SDP mode on the warehouse record |

A **pre-approval site visit by an HMRC officer** is part of the process.

---

## The approval conditions, verbatim

A duty management system is authorised only if it meets all of these:

> - allow for a full audit of the warehousing arrangements including physical
>   examinations when required and any documentation for goods released to free
>   circulation can be checked
> - together with commercial stock records, it should contain all the relevant
>   information necessary for the operation, validation and integrity of the
>   warehousing arrangements
> - identify goods with a tariff preference or quota or licensing restriction
>   and make sure the appropriate certificate or licence is available prior to
>   removal of the goods to free circulation
> - stock records must be updated as soon as information becomes available but
>   no later than before midnight of the following warehouse operation day,
>   when a duty management system used in support of a commercial system

Each maps to a hard product requirement:

| HMRC condition | FreightCode must |
|----------------|------------------|
| Full audit including physical examination | Make any stock lot traceable to its entry MRN, its documents, and its physical location, on demand |
| Contains everything needed for integrity | Hold the full stock account, not a partial view of it |
| **Identify preference / quota / licence and ensure the certificate is available before removal to free circulation** | **Block discharge to free circulation when a required licence or proof of origin is absent.** This is the single most product-shaping sentence in the handbook |
| Update deadline | Know which of the two authorised modes the warehouse runs |

---

## Two authorised modes, and why the difference matters

HMRC permits two arrangements, and they impose different obligations:

**Real-time processing (the standard).**
> "Unless authorised to use a duty management system in support of a commercial
> system, receipts and removal information must be updated by real-time
> processing. This makes sure that at any point in time, customs warehouse
> stock records accurately reflect the current stock of goods under the customs
> warehouse procedure."

**Closing stock balance, in support of a commercial system.**
Updates may lag, but no later than **before midnight of the following warehouse
operation day**. Additional conditions apply, including an audit trail from the
commercial system into the DMS, and:

> "Before any closing stock balance system is authorised, it will need to be
> tested to make sure that it can handle the proposed volume of goods to be
> entered and removed. The warehousekeeper should provide evidence that this
> testing has taken place."

So a volume test with retained evidence is a precondition for the second mode.

If EIDR is used for warehouse removals, real-time processing is **mandatory**:

> "If authorised to use the simplified declarations for imports with entry in
> the declarant's records, it is permissible to use it for both placing goods
> into and removing goods from the customs warehouse. This can only be done if
> the warehouse stock records are maintained by real-time processing."

**Implication:** the warehouse record needs a `stockUpdateMode` of
`real_time | closing_balance`, and selecting EIDR must force `real_time`.

---

## The commercial system and the DMS are one system

> "The commercial records and duty management system are to be regarded as one
> system and therefore constitute the customs warehouse stock account for the
> purposes of: the SCDP Entry in Declarant's Records (EIDR) authorisation, the
> stock records"

FreightCode is unlikely to be the customer's WMS. It will sit alongside one. So
the integration boundary is itself part of what gets approved — HMRC tests it:

> "The interfaces and reconciliations between inventory system and the
> Simplified Customs Declaration Process (SCDP) messaging system will be tested
> by HMRC as part of the assurance activity."

---

## Third-party operation

> "Duty management systems may be operated by the warehousekeeper or a third
> party. When maintained by a third party, the warehousekeeper must always have
> access to the duty management system records, preferably view only access or
> by daily reporting of data relating to receipts, deliveries, adjustments and
> balances."

If FreightCode operates the DMS on a customer's behalf — which a SaaS
arrangement arguably is — the warehousekeeper must have permanent access, or
daily reporting of receipts, deliveries, adjustments and balances. Daily
reporting is the safer reading and should be built either way.

---

## What this means for the build

Ranked by how much they shape the product:

1. **Discharge to free circulation must be blockable.** A lot flagged as needing
   a licence, preference proof or quota certificate cannot be released until the
   document is present. This is an HMRC approval condition, not a nicety.
2. **The stock account is the product.** Declaration submission is the smaller
   half. Without a compliant stock account FreightCode is an H2 filing tool, not
   customs warehousing software.
3. **Real-time is the default.** Build for it; treat closing-balance as the
   exception that needs a mode flag and volume-test evidence.
4. **Ship the approval evidence pack.** Every customer's supervising office asks
   for the same screenshots and reports. Generate them.
5. **On-demand reconcile.** An officer must be able to ask for stock records to
   be brought current and watch it happen.
6. **Four-year retention from discharge**, not from entry.

---

## Unresolved

- **No published technical standard.** HMRC gives criteria in prose and defers
  to the supervising office. There is no conformance test to build against, so
  "approved" will vary somewhat by office.
- **Whether a SaaS provider counts as third-party record keeping.** The guidance
  contemplates a third party maintaining the DMS but does not address hosted
  software specifically. Building the daily-reporting capability makes the
  question moot.
- **No evidence of a vendor-side HMRC testing route** for customs warehousing,
  unlike CDS. If one exists it is not in this guidance; worth asking the
  supervising office of the first pilot warehouse.
