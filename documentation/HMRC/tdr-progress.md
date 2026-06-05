# CDS Submission Progress Tracker

**Goal:** Get a single declaration through the v2.0 Trade Test as **DMSACC → DMSCLE** (no DMSREJ), proving end-to-end submission validity.

**Active lane:** HS 8471300000 / CPC 4000 000 / Origin DE / EORI GB553202734852 (Trade Test Data Library)
**Description:** Portable automatic data processing machine, weight ≤ 10kg (laptops from Germany)
**Documents:** N935 (commercial invoice, AC), N271 (packing list, AC)

**Current stage:** Lane updated to DE/laptops. Scenario runner wired. Run dry-run to confirm preflight, then submit.

---

## Stage gates (in order)

### ✅ Reached HMRC
- [x] OAuth token refresh on the fly
- [x] Fraud prevention headers accepted (no PAYLOAD_FORBIDDEN)
- [x] WAF / proxy layer accepts payload

### ✅ Schema-clean
- [x] WCO DEC-DMS:2 namespace + envelope accepted
- [x] Declaration xs:sequence (alphabetical) accepted
- [x] GoodsShipment xs:sequence accepted
- [x] Consignment ordering: ContainerCode → ArrivalTransportMeans → GoodsLocation
- [x] No `xml_validation_error` on submit
- [x] MRN assigned every submission

### ✅ Code-list grounded (Stage 1 build)
- [x] 11 HMRC code lists seeded from `github.com/hmrc/wco-dec`
- [x] Local validator catches invented codes before submission
- [x] Method 1 → N935 invariant enforced
- [x] DeclarationOfficeID validated against real customs offices
- [x] Procedure code split (DE 1/10) validated against `procedure_codes` + `previous_procedure_codes`
- [x] Additional documents validated as combined CategoryCode+TypeCode
- [x] Field-error surfacing in dry-run handler

### ✅ Cleared business rules
- [x] **15A T022** — AuthorisationHolder linkage (CGU removed cleanly)
- [x] **28A → 10A T034** — CurrencyExchange combination

### ⏳ Transport / authorisation layer (in progress)
- [ ] **CDS12073 / 57A** — BorderTransportMeans data combination — *full triplet didn't fix; needs deeper investigation (mode/IdType combo or country-context rule)*
- [ ] **R123 / 57B** — ArrivalTransportMeans rule — *mirroring BTM didn't satisfy R123; may need differentiated transport (sea→inland)*
- [ ] **R038 / 74A** — SupervisingOffice rule — *empirically fires whether SupervisingOffice is present or absent; rule semantics need verification*
- [ ] **CDS12100 / 22B 090** — Seller country — *blocked on confirming `dispatchCountry` value on the lane*

### ⏳ Lane data verification (blocking tasks)
- [ ] Confirm `dispatchCountry === "DE"` and item `originCountry === "DE"` on the test declaration
- [ ] Confirm `locationId === "GBAUFXTFXTFXT"` (Appendix 16C ODS — not `GBAUFXTFXTGW`)
- [ ] Confirm `transportId`, `transportMode` populated (maritime lane: mode 1, vessel name)

### ⛔ Deferred — converge remaining DMSREJ (see `spec/errors-handled.md`)
- [ ] **04A / 16A / 09B** — Charge/deduction valuation breakdown (R009, R050)
- [ ] **02A / 03A** — Additional information (CDS12056)
- [ ] **70A 166** — Additional procedure code (DE 1/11)
- [ ] **41A 122 / 188 / 371** — Supplementary units, location qualifier
- [ ] **79A 112** — Additional supply chain actor
- [ ] **03A 226** — Additional information code
- [ ] **50A 164** — Origin code refinement
- [ ] **39B 188** — Specific circumstances
- [ ] **21A 337** — Charge code
- [ ] **67A 103 / 68A 103** — Country-context tag

### 🎯 Final acceptance
- [x] Single submit returns DMSACC (FC-MPYAJ7RN — 0 validation errors; CDS13000 advisory only)
- [x] Status notification chain: DMSACC → DMSCLE on `26GB63M1I0RQFCVAR4` (`2026-06-04T18:56:07Z`, SDST pack `scenario-1-happy-path.md`)
- [ ] Evidence captured: request XML, response XML, conversation ID

---

## Recent rejections (most recent first)

| Date (UTC) | MRN | Outcome | Notable change |
|------------|-----|---------|----------------|
| 2026-04-25 20:48 | 26GB4K4SM9N4C41AR9 | DMSREJ | Pass 2: full BTM+ATM triplets, SupervisingOffice removed → cleared 15A & T034 |
| 2026-04-25 15:06 | 26GB4JSLGF50Y1CAR1 | DMSREJ | Pass 1: ContainerCode reorder, ATM restored, SupervisingOffice added, CGU removed |
| earlier | 26GB4JRMRZLCE2OAR9 | DMSREJ | CGU added → cascade; reverted next pass |
| earlier | 26GB4JMUN9DN9IBAR1 | DMSREJ | First real CDS engagement (post-validation-layer build) |

---

## Notes

- A "cleared" declaration in this context = no `<Error>` elements in the Response, status flips from `Processing` to `Accepted`, then HMRC issues clearance (DMSCLE).
- Each pass aims to clear specific rule families without unlocking new cascades. Keep changes surgical.
- Never auto-add authorisations, procedures, or documents the user hasn't explicitly authorised — every "advanced" feature triggers 10+ hidden requirements.
