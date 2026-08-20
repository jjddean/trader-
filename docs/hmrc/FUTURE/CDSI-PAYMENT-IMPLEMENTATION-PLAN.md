# FreightCode CDS payment and CDSI implementation specification

**Status:** FUTURE — not started. Frozen, approved plan for later delivery.  
Scope owner: FreightCode  
Scope: UK CDS import H1 declarations currently produced by FreightCode  
Rule for changing this plan: implementation convenience does not change the scope. Amend it only where a newer HMRC publication, schema, code list, or verified Trade Test response contradicts this specification. Record such a change with its source and date before changing application behaviour.

## 1. Required outcome

FreightCode will support the complete duty-payment path for the tax lines it currently emits (`A00` customs duty and `B00` import VAT):

1. The declarant selects a valid settlement route in plain language.
2. FreightCode stores the resulting DE 4/8 instruction by tax type, not as one ambiguous declaration-wide value.
3. FreightCode serializes DE 4/8 into every applicable `GovernmentAgencyGoodsItem/Commodity/DutyTaxFee/MethodCode` occurrence in the WCO DMS 3.6 declaration.
4. Immediate-payment declarations use an HMRC immediate MOP code and produce a final `DMSTAX` payment instruction.
5. FreightCode extracts, validates, stores and displays the 16-character `CDSI` reference returned by HMRC.
6. Deferment and CDS cash-account declarations include their required supporting data elements.
7. Invalid combinations are blocked before XML generation and before submission.
8. The original HMRC notification remains the authoritative audit evidence.

This feature does **not** collect money, take card details, initiate a bank payment, or infer that HMRC has received payment. FreightCode links to the official HMRC payment service and continues to derive customs clearance only from HMRC notifications.

## 2. HMRC rules implemented

- DE 4/8 is item-level, repeatable by duty/tax type. A method is required only where revenue must be paid or secured.
- Immediate-payment MOP codes are `A`, `B`, `C`, `H`, `M`, and `Z`. If one of these is used, all populated DE 4/8 occurrences across all goods items must use an immediate-payment code. Immediate and non-immediate codes must never be mixed.
- Code `G` is obsolete and must be rejected everywhere.
- Codes `E` and `R` require a DE 2/6 deferment account number. FreightCode's present H1 mapper supports one 7-digit `1DAN` applying to all charges.
- Codes `N` and `P` use a CDS cash account and require DE 8/2 guarantee type `Y` plus DE 8/3 guarantee reference containing the cash-account holder's EORI in the GRN component.
- PVA is not represented by a fake DE 4/8 payment code. For `B00`, DE 4/8 remains absent and the PVA claim is represented through the required DE 3/40 VAT identity and associated HMRC completion rules. PVA implementation is included because applying the duty MOP blindly to `B00` is incorrect.
- When a valid immediate method is used, final `DMSTAX` is the payment instruction and includes the per-declaration CDSI reference. A preliminary/indicative DMSTAX must not be presented as a payable instruction.
- A CDSI reference is 16 characters and begins `CDSI`. A different reference is issued for each declaration.
- `DMSCPI` means the balance against a deferred or similar account is insufficient; `DMSCPR` is a reminder/action notification. Both must be recognized and shown as action-required events.

Authoritative sources:

- HMRC Appendix 9, DE 4/8 MOP codes: https://www.gov.uk/government/publications/method-of-payment-codes-for-data-element-48-of-the-customs-declaration-service
- HMRC Group 4, DE 4/8 completion rules: https://www.gov.uk/government/publications/cds-uk-trade-tariff-volume-3-import-declaration-completion-guide/group-4-valuation-information-and-taxes/
- HMRC Group 8, DE 8/2 and DE 8/3: https://www.gov.uk/government/publications/cds-birds-declarations-and-customs-clearance-request-completion-instructions/group-8-other-data-elements-statistical-data-guarantees-and-tariff-related-data
- HMRC notification definitions: https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/notifications.html
- HMRC immediate-payment instructions: https://www.gov.uk/guidance/pay-for-imports-declared-using-the-customs-declaration-service
- HMRC Customs Declarations API schemas and examples: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/1.0/oas/page

## 3. Frozen data model

### Declaration inputs

Add the following fields to `declarations` in `convex/schema.ts`:

```ts
paymentInstructions?: Array<{
  taxType: "A00" | "B00";
  methodCode?: string;
}>
paymentJourney?: "immediate" | "deferment" | "cash_account" | "pva_split" | "no_revenue"
cashAccountHolderEori?: string        // DE 8/3; only N/P
postponedVatAccounting?: boolean      // controls B00 omission and DE 3/40
pvaVatRegistrationNumber?: string     // DE 3/40; present only for PVA
```

Retain the existing `defermentAccountNumber` for DE 2/6.

Retain legacy `paymentMethodCode` temporarily for draft migration only. It must not be read by the mapper after migration has completed, and it must not be written by the new form.

### HMRC-derived settlement record

Add a dedicated `declaration_settlements` table rather than mixing response facts into editable declaration input:

```ts
declarationId: Id<"declarations">
userId: string
orgId?: string
mrn?: string
conversationId?: string
sourceNotificationId: Id<"notifications">
sourceNotificationType: "DMSTAX" | "DMSCPI" | "DMSCPR"
instructionKind: "immediate_payment" | "account_reservation" | "account_shortfall" | "reminder"
paymentReference?: string             // CDSI reference from final DMSTAX
currency?: string
amountPayable?: number
paymentDeadline?: string              // only when present in HMRC XML
status: "awaiting_payment" | "account_reserved" | "account_shortfall" | "reminder" | "superseded"
hmrcIssueDateTime?: string
createdAt: number
updatedAt: number
```

Indexes: `by_declaration`, `by_declaration_and_status`, `by_payment_reference`, and `by_source_notification` (unique by application logic).

Do not create a `paid` status from elapsed time, user confirmation, or the presence of `DMSCLE`. Payment and clearance are distinct facts. The UI may show clearance separately using the existing declaration status.

## 4. Fixed user choices and mappings

The form presents four business choices, not the raw Appendix 9 list:

| User choice | A00 method | B00 method | Supporting fields |
|---|---:|---:|---|
| Pay HMRC immediately | `A` | `A` | none; final DMSTAX supplies CDSI |
| Duty deferment account | `E` | `E` | 7-digit DE 2/6 `1DAN` |
| CDS cash account | `P` | `P` | DE 8/2 `Y`; DE 8/3 cash-account holder EORI |
| Defer duty and use PVA for VAT | `E` | omitted | 7-digit DE 2/6; DE 3/40 VAT identity and PVA completion data |

`A` is the single FreightCode immediate-payment default because it means immediate payment in cash and results in the CDSI journey. The UI does not expose `B`, `C`, `H`, `M`, or `Z` in the standard workflow. The validation and serializer accept those codes for imported/legacy specialist records, but no user-facing choice is added without a separate supported use case.

`N` and `R` remain accepted by the domain validator for valid specialist/security cases but are not standard UI choices. Code `G` is always invalid.

“No revenue to pay or secure” is system-derived from applicable tax lines; it is not a way for the user to avoid payment. It emits no DE 4/8.

## 5. Implementation steps

Each numbered part is independently reviewable but the feature is not production-complete until Part 8 passes.

### Part 1 — Replace the payment domain model

Files:

- `src/lib/payment-method.ts`
- `convex/schema.ts`
- `convex/declarations.ts`
- `src/app/dashboard/declarations/[id]/page.tsx`
- `convex/representation.ts`

Work:

1. Replace `PAYMENT_METHOD_OPTIONS` with the four business choices in section 4.
2. Add exported constants for immediate (`A,B,C,H,M,Z`), deferment (`E,R`), cash-account (`N,P`) and forbidden (`G`) code sets.
3. Replace `validatePaymentFields` with a pure validator accepting declaration category, additional declaration type, payment instructions, DAN, cash-account EORI and PVA fields.
4. Add the new Convex fields and mutation validators.
5. Update the form to show only fields required by the selected journey and to clear incompatible stale fields on a journey change.
6. Add a read-only summary showing the resulting A00 and B00 treatments before submission.
7. Keep legacy drafts readable. Convert a legacy declaration-wide code into A00 and B00 instructions on first save; never silently migrate `G`; surface it as “payment method must be reviewed.”

Acceptance gate:

- A draft can save each of the four journeys.
- Invalid DAN/EORI/PVA combinations fail identically in client and server validation.
- No new write populates `paymentMethodCode`.

### Part 2 — Add submission-blocking CDS rules

Files:

- `src/lib/payment-method.ts`
- the shared declaration preflight used by `src/app/api/hmrc/submit/route.ts`
- `convex/declarations.ts`

Work:

1. Require one instruction per revenue-bearing tax type unless that tax type is correctly omitted for PVA.
2. Reject obsolete/unknown MOP codes.
3. Reject mixing any immediate code with a non-immediate code anywhere in the declaration.
4. Enforce consistent treatment for the same tax type across every goods item.
5. Enforce `E/R -> valid 1DAN` and reject DAN for unrelated journeys.
6. Enforce `N/P -> DE 8/2 Y + valid GB/XI cash-account-holder EORI`.
7. Enforce simplified declaration restrictions: additional declaration types `C`, `F`, `Y`, or `Z` may use only `E` or `R` where the HMRC completion rule applies.
8. Enforce PVA as B00 DE 4/8 omission plus complete DE 3/40 data; never serialize `E` or `A` on B00 in the PVA split journey.

Acceptance gate:

- Invalid payment declarations cannot reach XML generation or HMRC submission.
- Errors name the business field and DE number, and identify the affected tax type.

### Part 3 — Correct WCO DMS 3.6 serialization

Files:

- `src/lib/wco-mapper.ts`
- `src/lib/h1-xml-renderer.ts`
- `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd` (validation input only)

Work:

1. Remove the declaration-wide `dutyTaxFeeMethod` spread.
2. Resolve the method independently for each emitted `DutyTaxFee.TypeCode`.
3. Emit `<MethodCode>` immediately after the applicable fields in the XSD-defined `DutyTaxFee` sequence and only when DE 4/8 is populated.
4. Apply the chosen A00/B00 instruction consistently to every goods item.
5. Add DE 8/2 and DE 8/3 `ObligationGuarantee` mapping for N/P using `SecurityDetailsCode: Y` and the holder EORI in the schema-defined guarantee-reference component.
6. Add the DE 3/40 party/fiscal-reference mapping required for the PVA split journey.
7. Validate every generated fixture against the repository WCO XSD before accepting mapper tests.

Acceptance gate:

- XML snapshots show A00 and B00 methods independently.
- Immediate A appears on all populated A00/B00 tax lines.
- PVA XML contains no B00 MethodCode.
- Cash-account XML contains DE 8/2 Y and the correct DE 8/3 EORI.
- All fixtures pass XSD validation.

### Part 4 — Parse DMSTAX and accounting notifications structurally

Files:

- latest HMRC notification XSD/sample archive saved under `docs/hmrc/specs/notifications/`
- `src/lib/hmrc-notification-parser.ts`
- `src/app/api/hmrc/webhooks/notify/route.ts`
- `src/lib/hmrc-pull-notifications.ts`
- `convex/notifications.ts`
- `convex/schema.ts`

Work:

1. Save the exact HMRC XSD and annotated DMSTAX, DMSCPI and DMSCPR samples used for implementation with source URL and retrieval date.
2. Extend `ParsedNotification` with a typed settlement result: final/indicative marker, instruction kind, payment reference, amounts, currency and deadline when supplied.
3. Parse by namespace-insensitive XML structure derived from the HMRC XSD; do not search the whole payload for an arbitrary `CDSI` substring.
4. Validate a payment reference with `^CDSI[A-Z0-9]{12}$` before persistence. Preserve the raw value in the notification when invalid, but do not publish it as payable.
5. Recognize notification codes 14 `DMSCPI` and 15 `DMSCPR`; correct the existing notification code/type map against the current HMRC table.
6. Run the same parser for push and pull ingestion.
7. Upsert `declaration_settlements` using `sourceNotificationId`; repeated push/pull delivery cannot duplicate an instruction.
8. A newer final DMSTAX supersedes an earlier settlement instruction for the same MRN while preserving both notification records.

Acceptance gate:

- Official samples parse into deterministic typed results.
- Indicative DMSTAX never produces an actionable CDSI card.
- Push and pull copies are idempotent.
- DMSCPI/DMSCPR display as action required and do not downgrade an accepted declaration incorrectly.

### Part 5 — Build the CDSI payment experience

Files:

- `src/app/dashboard/declarations/[id]/status/page.tsx`
- `src/lib/notification-labels.ts`
- `src/lib/notification-context.ts`
- `src/components/dashboard-header.tsx`
- relevant client portal declaration detail component/query in `convex/client_portal.ts`

Work:

1. Add a settlement card above the status timeline when an actionable final DMSTAX exists.
2. Display: “Payment required”, CDSI reference with copy button, HMRC amount/currency, deadline if provided, MRN, notification time, and the declaration's selected method.
3. Link “Pay HMRC” to the official GOV.UK immediate-payment guidance/service; open it in a new tab. Never construct a payment URL containing customer data unless HMRC officially documents that URL contract.
4. State that HMRC issues one CDSI reference per declaration and that the full reference must be used.
5. For account reservation, show “Charged/reserved against account” without a pay button.
6. For DMSCPI/DMSCPR, show a persistent action-required banner with the HMRC explanation and relevant account context.
7. Expose the payment instruction to an authorized client-portal user but never expose a broker-owned DAN or unrelated account identifiers.
8. Add accessible labels, keyboard-copy behaviour and responsive layouts.

Acceptance gate:

- A broker and an authorized client can find and copy the same CDSI reference without opening raw XML.
- Users cannot confuse an estimate, indicative DMSTAX, or deferment reservation with an amount requiring immediate payment.

### Part 6 — Update financial records and audit

Files:

- `convex/declarations.ts`
- `convex/lib/financial_obligations.ts`
- `convex/schema.ts`
- `convex/audit.ts` or the existing audit mutation used by notifications

Work:

1. Replace heuristic DMSTAX amount extraction with the structured parser result.
2. Continue retaining original raw notification XML as the source of truth.
3. Attach settlement provenance to financial obligations: notification ID, issue time, MRN and instruction kind.
4. Audit payment-journey selection changes, CDSI receipt, settlement supersession and account-shortfall receipt. Never write DANs or other protected account values into audit metadata.
5. Update payment labels to reflect per-tax-type treatment instead of one declaration-wide label.

Acceptance gate:

- Financial records reconcile to the final structured DMSTAX.
- Every displayed CDSI value traces to one stored HMRC notification.
- Audit exports contain events but no secret/account credentials.

### Part 7 — Migration and backward compatibility

Files:

- a new internal Convex migration in the repository's existing migration pattern
- `convex/declarations.ts`
- `src/lib/payment-method.ts`

Work:

1. Dry-run-report counts of legacy blank, E, R, G, P and unknown values.
2. Convert `E/R` plus valid DAN to matching A00/B00 instructions.
3. Convert blank to an unconfigured payment journey requiring review; do not infer no revenue.
4. Mark `G`, legacy `P`, and unknown codes for manual review because their old UI labels were incorrect.
5. Do not delete legacy fields in the first release. Stop reading them after migration, monitor for one release, then remove them in a separate cleanup change.
6. Migration is idempotent and scoped by declaration ID/tenant; it must not alter submitted XML or historical notification evidence.

Acceptance gate:

- Dry-run and applied counts reconcile.
- No submitted declaration is mutated.
- Every affected draft either has valid new instructions or an explicit review block.

### Part 8 — Verification and release gate

Automated tests:

- Extend `tests/h1/mapper-xml.test.ts` for immediate A, deferment E, cash-account P, PVA split, no-revenue omission and multi-item consistency.
- Add `tests/h1/payment-method.test.ts` for the complete validation matrix.
- Extend `tests/h1/notification-parser.test.ts` with official DMSTAX/DMSCPI/DMSCPR fixtures, indicative versus final DMSTAX, malformed references and namespaces.
- Extend notification idempotency/status tests for push/pull duplicates and shortfall/reminder precedence.
- Add Convex settlement tests for upsert, supersession, tenant isolation and portal redaction.
- Add Playwright coverage for all four form journeys and the CDSI status card.

Commands:

```text
npm run lint
npm run test:h1
npm run build
npm run test:e2e
```

HMRC environment evidence:

1. Submit an HMRC-supported immediate-payment H1 scenario with MOP A through Trade Test/TDR as applicable.
2. Capture submitted XML proving DE 4/8 on every applicable A00/B00 occurrence.
3. Capture DMSACC and final DMSTAX containing the CDSI reference.
4. Prove that FreightCode stores and displays exactly the reference and amount contained in DMSTAX.
5. Retrieve the same notification through pull and prove idempotency.
6. Submit one deferment scenario and one cash-account scenario where HMRC test facilities support them; retain responses and XSD validation output.

Production release is blocked until automated tests pass and the immediate-payment evidence items 1–5 are complete. Cash-account UI may not be enabled in production until its XML has either passed the supported HMRC test route or received written SDST confirmation.

## 6. Delivery estimate

This is **12–16 engineering days**, excluding HMRC waiting time:

| Part | Estimate |
|---|---:|
| 1. Domain model and form | 2–3 days |
| 2. Validation | 1–2 days |
| 3. WCO mapping, cash account and PVA | 3–4 days |
| 4. Structured notification processing | 2–3 days |
| 5. Broker/client payment experience | 1–2 days |
| 6. Financial records and audit | 1 day |
| 7. Migration | 1 day |
| 8. Automated and HMRC verification | 1–2 days plus external response time |

The parts must be implemented in the numbered order. Parallel work is permitted only within a part after its data contracts are merged. No partial release may advertise CDSI payment handling before Part 8 passes.

## 7. Explicit exclusions

- Taking or processing payments inside FreightCode.
- Storing bank/card details or HMRC Government Gateway credentials.
- Automatically asserting that an immediate payment has settled without an authoritative HMRC event.
- General-guarantee-account and specialist security workflows beyond accepting valid imported codes.
- Export declarations, C21i and declaration categories not currently emitted by FreightCode's H1 mapper.
- Inventing undocumented HMRC XML paths, payment URLs or notification meanings.

## 8. Definition of complete

The plan is complete only when an authorized FreightCode user can select **Pay HMRC immediately**, submit a valid H1 XML carrying DE 4/8 on every applicable tax line, receive final DMSTAX by push or pull, see and copy the exact 16-character CDSI reference and HMRC amount, follow the official payment route, and continue to see the authoritative HMRC clearance state—while deferment, cash-account and PVA declarations serialize their distinct required data and invalid combinations are stopped before submission.
