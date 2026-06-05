# Pre-TDR gates — Freightcode

**Sources (read 2026-06-03):**

| Doc | Location | Key requirement |
|-----|----------|-----------------|
| CDS RunBook V4.3 | `tmp/.../CDS RunBook V4.3.pptx` slides 6–7, 30, 32 | TT: integration testing for **all APIs**; **all core declaration processes and notification types**; **prove in TT before TDR** |
| Path to Production 2024 | `tmp/hmrc_tdr_audit/The_Path_to_Production_2024.pdf` | TT: complete **declaration scenarios** → **Complete Pre-TDR steps\*** (detail in Runbook) |
| CDS RunBook V4.3 | slides 9–11, 24 | TDR: **not** for performance/technical testing; **end-to-end declaration journeys** with **real account data** |

**Not in Runbook PDF extract:** a numbered “Pre-TDR checklist” page — Path to Production points to Runbook for `Pre-TDR steps*`. This file is Freightcode’s operationalisation of Runbook slides 6–7 + Path to Production sequence.

---

## A. Trade Test — already proven (lane: H1 / DE laptops / CPC 4000)

| Gate | Status | Evidence |
|------|--------|----------|
| Generate valid CDS XML (v2.0) | Done | `spec/passing-payload.xml`, dry-run gate |
| Submit → 202 + MRN | Done | FC-MPYAJ7RN / `26GB63M1I0RQFCVAR4` |
| 0 CDS validation errors (DMSACC) | Done | DMSACC FunctionCode `01` |
| Handle synchronous submit response | Done | `src/app/api/hmrc/submit/route.ts` |

---

## B. Trade Test — notifications (Runbook: “all … notification types”)

| Notification / capability | Parser + store | Live TT proof | Status |
|---------------------------|----------------|---------------|--------|
| DMSACC | Yes | Yes (FC-MPYAJ7RN) | Done |
| DMSTAX (FC 13, NameCode 4/67) | Yes | Yes | Done |
| DMSCLE | Yes | No on passing MRN | **Done (handler)** — audit `test-evidence/passing/notification-audit-FC-MPYAJ7RN.md` |
| DMSREJ | Yes | Yes (prior LRNs) | Done |
| DMSINV | Yes | Unit test FC `02` | Done (parser); live scenario optional |
| DMSROG / DMSCTL / DMSRES | Yes | Unit tests | Done (parser); live optional |
| Webhook ingest | Yes | Yes | Done |
| Pull notifications (fallback) | Yes | Status page **Pull** + post-submit | Done (UI + route) |
| Status precedence | `convex/lib/notification_status.ts` | Unit tests | Done |

---

## C. Trade Test — APIs (Runbook slide 6: “Integration testing for all APIs”)

| API | Route exists | UI / journey tested |
|-----|--------------|---------------------|
| Customs Declarations 2.0 submit | Yes | Yes (passing lane) |
| Pull Notifications 1.0 | Yes | Status page **Pull notifications** |
| Push Notifications (callback) | Yes | Yes (bell) |
| Customs Declarations Information 2.0 | Yes | Status page **Query HMRC status** |
| Amend (FC 13) | Yes | Status page (Accepted + MRN) |
| Cancel (FC 13 + INV) | Yes | Status page (Accepted + MRN) |
| Secure document upload | Yes | Deferred — `spec/journey-scope.md` |

---

## D. Trade Test — core declaration journeys (breadth)

Runbook TT scope includes: **all declaration types and procedures** (slide 6). Freightcode has **one** passing journey only.

| Journey (examples from Runbook / TT scope) | Spec lane | TT submit proof |
|---------------------------------------------|-----------|-----------------|
| H1 import frontier (Type A, free circulation) | `spec/lane.md` | DMSACC |
| H2 warehousing / supplementary | — | — |
| Inward processing / OSR | — | — |
| Export A–Z types | — | — |
| Inventory linking | — | — |
| Amendment / invalidation | API only | TT may limit amend scope per milestone — check current TTM scope bulletin |

**Pragmatic TT exit:** See `spec/journey-scope.md`. Minimum = passing lane + sections B–C complete + `test-evidence/tt-evidence-pack/`.

---

## E. Before requesting TDR access (Runbook + Path to Production)

1. Complete declaration scenarios in TT (at minimum: passing lane + one unhappy path DMSREJ retained as regression).
2. Complete **Pre-TDR steps** per Runbook (SDST may ask for evidence of TT integration).
3. Register **separate** TDR application; request TDR API subscriptions from SDST ([Runbook slide 10](https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/resources/CDS_Technical_Documentation.zip) — TDR APIs often **v1.0** Declarations + Pull Notifications).
4. Do **not** use TDR for performance testing ([Runbook slide 9, 24](https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/resources/CDS_Technical_Documentation.zip)).
5. Plan **end-to-end journeys in TDR** with declarant real account data (EORI, DAN, authorisations) — amend, cancel, notifications, status query.

---

## F. Freightcode subjective gate

**Reasonable for one lane (0 CDS errors on accept)** — yes.  
**Ready for TDR request** — after sections **B** and **C** have live or documented proof, not only DMSACC on one MRN.
