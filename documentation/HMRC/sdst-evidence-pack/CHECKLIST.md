# Master checklist — CDS production + optional SS-GB

Copy values from completed rows into `forms/CDS-Production-Checklist-v1.2.odt`.  
Evidence files live in this pack only (`evidence/`).

**Legend:** `[x]` done · `[ ]` open · `[-]` not applicable

---

## CDS — Application & admin (`forms/CDS-Production-Checklist-v1.2.odt`)

### §1 Application details → `evidence/01-application-details.md`

- [ ] Organisation name filled in ODT + `01-application-details.md` *(Freightcode — confirm legal name)*
- [x] Sandbox application name + ID — **freightcode** / `b74874e9-957e-4a40-b426-0cde839f8a45`
- [ ] Production application name + ID — **freightcode** requested; ID pending until credentials issued
- [ ] Deployment model (SaaS vs on-premise)
- [x] Notification model: **push** — sandbox `https://cf94-62-31-164-236.ngrok-free.app/api/hmrc/webhooks/notify`
- [ ] Production callback URL(s) (no ngrok for prod)

### §2 Rate limit

- [x] Selected **3 rps** (declared for Freightcode)

### §3 APIs in use

- [x] Customs Declarations API — in product
- [x] Customs Declarations Information API — in product (`GET` status by MRN route exists)
- [ ] Customs Inventory Linking Exports — **[-]** unless export ILE in scope
- [ ] Bulk Data File List — **[-]** unless tariff bulk download in scope
- [ ] TT or TDR evidence attached in ODT for **each** API ticked above

---

## CDS §4 — Customs Declarations API

| # | Endpoint | Status | Evidence folder / files |
|---|----------|--------|-------------------------|
| 4.1 | `POST /customs/declarations` (submit) | **[x]** | `evidence/02-submit/` + `scenario-1-happy-path.md` — DMSACC/DMSTAX (`FC-MPYAJ7RN`, `FC-MQ031D1B`); see `TRADE-TEST-REALITY.md` |
| 4.2 | `POST /customs/declarations/cancellation-requests` | **[x]** | `evidence/04-cancel/` — `26GB656DZN0FE7LAR0`, **`26GB65EJN3BYSELAR9`** (DMSINV FC02) |
| 4.3 | `POST /customs/declarations/file-upload` (initiate) | **[x]** | `evidence/06-file-upload/` — HTTP 200, ref `218eaeb7-…` |
| 4.4 | `POST /customs/declarations/amend` | **[x]** | `evidence/05-amend/` — `26GB664W3BLIFZFAR4`, DMSRES FC07, VersionID 2, GBP 8000 |
| 4.5 | `POST /customs/declarations/arrival-notification` | [-] | Only if product scope includes arrival |

### §4.1 submit — acceptance criteria met

- [x] HMRC returned **DMSACC** with **0** CDS validation errors
- [x] Request XML archived in pack
- [x] Notification audit written (`evidence/03-notifications/audit.md`)
- [x] TT accept path documented — **DMSACC + DMSTAX**; DMSCLE not required on accept-only (`TRADE-TEST-REALITY.md`)
- [x] Submit **X-Conversation-ID** `68edb212-5c4a-4ef7-9223-f55630c5859e` in `LOG.md` (copy to ODT)

---

## CDS §5 — Notifications & information

### Push / pull notifications

- [x] Push webhook configured (Developer Hub metadata)
- [x] DMSACC + DMSTAX observed on passing MRN (`evidence/03-notifications/`)
- [ ] Pull notifications API exercised with evidence → `evidence/08-pull-notifications/`
- [ ] Additional notification types in product scope documented in `audit.md` when seen live

### §5.2 Customs Declarations Information

| Endpoint | Status | Evidence |
|----------|--------|----------|
| `GET .../mrn/{mrn}/status` | **[x]** | `evidence/07-status-query/` — HTTP 200, ICS 22, Accept `application/vnd.hmrc.1.0+xml` |
| `GET .../ducr/{ducr}/status` | [-] | If not used |
| `GET .../ucr/{ucr}/status` | [-] | If not used |
| `GET .../inventory-reference/.../status` | [-] | If not used |

---

## CDS — Submit to SDST

- [ ] All `[ ]` rows above completed or marked N/A in ODT
- [ ] `forms/CDS-Production-Checklist-v1.2.odt` filled with correlation IDs / MRNs / timestamps from **LOG.md**
- [ ] Completed ODT sent to SDST within **14 days** of last sandbox test (per checklist footer)

---

## SS-GB — `forms/SS-GB-Production-Application-Checklist-v2.3.odt`

**Entire section [-] unless Freightcode offers import ENS.**

- [-] §1–§6 ENS endpoints — skip for CDS-only product
- [-] Return SS-GB ODT to SDST — N/A

---

## Engineering gates (not on ODT — track before prod cutover)

Reference only; detail in `spec/pre-tdr-checklist.md`.

- [x] Notification status precedence (DMSACC, DMSCLE, DMSROG, etc.) — unit tests in `tests/h1/`
- [ ] Cancel / amend / upload flows tested end-to-end in app UI
- [ ] Status query returns 200 with valid token (fix any 401 from dashboard)

---

## Quick progress

| CDS ODT sections | Approx. complete |
|------------------|------------------|
| §1 Admin | 0% — fields empty |
| §2 Rate limit | 0% |
| §3 APIs | ~50% — ticks yes, evidence bundle incomplete |
| §4 Endpoints | ~20% — submit only |
| §5.2 Status | 0% |
| Return ODT | 0% |

**Overall CDS pack readiness: ~30%** (submit + partial notifications).
