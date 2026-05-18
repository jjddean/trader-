# HMRC TDR Integration Reference — TradeDNA

> **Last updated:** 2026-04-13  
> **Scope:** Customs Declarations API v1.0 | Trader Dress Rehearsal (TDR) | HMRC CDS  
> **Status:** Pre-pass. Blocked on CHED cross-system validation (CDS12050). See §8.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Developer Hub Setup](#2-developer-hub-setup)
3. [TDR Allowlisting](#3-tdr-allowlisting)
4. [OAuth 2.0 Authentication Flow](#4-oauth-20-authentication-flow)
5. [HTTP Headers Reference](#5-http-headers-reference)
6. [WCO XML Payload Specification](#6-wco-xml-payload-specification)
7. [AdditionalDocument Matrix — HS 0207129000](#7-additionaldocument-matrix--hs-0207129000)
8. [Error Codes & Root Causes](#8-error-codes--root-causes)
9. [Notification Flow](#9-notification-flow)
10. [Trade Test vs TDR — Key Differences](#10-trade-test-vs-tdr--key-differences)
11. [Codebase Gap Analysis](#11-codebase-gap-analysis)
12. [TDR Submission Checklist](#12-tdr-submission-checklist)
13. [Reference URLs](#13-reference-urls)

---

## 1. Architecture Overview

```
Browser (TradeDNA UI)
  └─ Clerk session → useMutation/useQuery (Convex real-time)

Next.js API Routes (/src/app/api/hmrc/)
  └─ auth/route.ts          — initiates HMRC OAuth flow
  └─ submit/route.ts        — maps declaration → WCO XML → POST /customs/declarations
  └─ amend/route.ts         — POST /customs/declarations/amend
  └─ cancel/route.ts        — POST /customs/declarations/cancel
  └─ notifications/pull/    — GET /notifications/conversationId/{id}/unpulled
  └─ webhooks/notify/       — receives HMRC push notifications (DMS* events)

src/lib/
  └─ wco-mapper.ts          — Convex declaration + goods_items → WCO H1 JSON
  └─ hmrc-fetch.ts          — wraps fetch() with fraud headers + 429 retry
  └─ xml-utils.ts           — xmlEscape() — mandatory on every interpolated value

Convex (convex/)
  └─ hmrc_tokens            — OAuth tokens (userId, accessToken, refreshToken, expiresAt)
  └─ declarations           — declaration records + conversationId
  └─ goods_items            — item-level data including additionalDocuments[]
  └─ notifications          — immutable DMS* notification log

HMRC CDS (external)
  Sandbox base: https://test-api.service.hmrc.gov.uk
  Prod base:    https://api.service.hmrc.gov.uk

  POST /customs/declarations           → submit
  POST /customs/declarations/amend     → amend (FunctionCode 13)
  POST /customs/declarations/cancel    → cancel
  GET  /notifications/conversationId/{id}/unpulled  → pull notifications
  POST {callback_url}                  → HMRC push webhook (DMS* events)
```

---

## 2. Developer Hub Setup

### Application Configuration

| Setting | Value |
|---------|-------|
| Environment | Sandbox (for TDR) |
| API | **Customs Declarations 1.0** — NOT 2.0 Beta |
| OAuth grant type | Authorization Code (user-restricted) |
| Redirect URI | `http://localhost:3000/auth/hmrc/callback` (dev) |
| Redirect URI | `https://freightcode.co.uk/auth/hmrc/callback` (prod) |
| Scope | `write:customs-declaration` |

### Critical: API Version Subscription

TDR requires **Customs Declarations 1.0** — not 2.0 Beta. These are separate APIs with separate scopes.

- If your application is only subscribed to **2.0 Beta**, OAuth will fail with "missing or misformatting the client_id parameter" because the scope `write:customs-declaration` belongs to 1.0.
- In the Developer Hub: **Manage API Subscriptions → Add → Customs Declarations → Version 1.0 → Subscribe**

### Redirect URI Registration

The `redirect_uri` in the token exchange must **exactly** match a registered URI in the Developer Hub (case-sensitive, no trailing slash difference).

Registered URIs needed:
```
http://localhost:3000/auth/hmrc/callback
https://freightcode.co.uk/auth/hmrc/callback
```

### EORI in Subscriptions

The EORI field on Developer Hub subscriptions is informational — HMRC doesn't cryptographically validate your XML EORI against the subscription EORI. However, keep it current to match your test user's EORI: **GB449181054677**

---

## 3. TDR Allowlisting

### CRITICAL: TDR Is Not the Standard Sandbox

The standard sandbox (Trade Test) is available to all registered applications. **TDR is a separate partition** that requires explicit allowlisting.

Without allowlisting:
- Your submissions go to Trade Test, not TDR
- Gov-Test-Scenario headers control outcomes in Trade Test
- HMRC will not count these submissions for Recognised Software assessment

### How to Get Allowlisted

1. Email **TDRcommunications@hmrc.gov.uk** with:
   - Company name
   - Developer Hub Application ID (your `HMRC_CLIENT_ID`: `ZSoA1lpJi8FyuzSsncFrOZKpmrNe`)
   - EORI(s) you will be testing with
   - Intended test scenarios
2. CC: **SoftwareDeveloperSupport@hmrc.gov.uk**
3. HMRC adds your Application ID to the TDR allowlist
4. TDR API version appears in your Developer Hub subscriptions

### Confirmation

Once allowlisted, HMRC will confirm via email and the TDR subscription will appear in your Developer Hub application. The Accept header is `application/vnd.hmrc.2.0+xml` — the routing is done server-side by HMRC based on your allowlist status.

---

## 4. OAuth 2.0 Authentication Flow

### Step 1 — Create Test User (one-time per test session)

Test users for Customs Declarations must be created via the Create Test User API, not the Developer Hub UI.

```bash
curl -X POST https://test-api.service.hmrc.gov.uk/create-test-user/organisations \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
  -d '{"serviceNames": ["customs-services"]}'
```

Response includes:
- `userId` — Government Gateway login ID (e.g. `245016021137`)
- `password` — Government Gateway password
- `eori` — Assigned test EORI (e.g. `GB449181054677`)

**Active test user (as of 2026-04-13):** See `documentation/HMRC/test-user.md`

### Step 2 — Initiate Authorization (`GET /api/hmrc/auth`)

File: `src/app/api/hmrc/auth/route.ts`

Builds and redirects to:
```
https://test-api.service.hmrc.gov.uk/oauth/authorize
  ?response_type=code
  &client_id={HMRC_CLIENT_ID}
  &scope=write%3Acustoms-declaration
  &state={uuid}.{clerkUserId}
  &redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fhmrc%2Fcallback
```

User signs in with Government Gateway credentials (test user ID + password).

### Step 3 — Callback & Token Exchange

File: `src/app/auth/hmrc/callback/route.ts`

HMRC redirects to `HMRC_REDIRECT_URI?code=AUTH_CODE&state=...`

The callback:
1. Parses `userId` from the `state` parameter (falls back to `HMRC_TEST_USER_ID` env var)
2. POSTs to `https://test-api.service.hmrc.gov.uk/oauth/token`:
   ```
   grant_type=authorization_code
   &code={AUTH_CODE}
   &redirect_uri={HMRC_REDIRECT_URI}
   &client_id={HMRC_CLIENT_ID}
   &client_secret={HMRC_CLIENT_SECRET}
   ```
3. Receives `access_token`, `refresh_token`, `expires_in` (typically 14400s = 4h)
4. Saves to Convex `hmrc_tokens` table under `userId`
5. Redirects to `/dashboard?success=hmrc_connected`

### Step 4 — Token Refresh (automatic)

File: `src/app/api/hmrc/submit/route.ts` lines 107–159

Before each submission, checks token expiry. If within 5 minutes of expiry, refreshes:
```
POST /oauth/token
grant_type=refresh_token
&refresh_token={stored_refresh_token}
&client_id=...
&client_secret=...
```

### OAuth Error: "missing or misformatting the client_id"

| Root Cause | Fix |
|------------|-----|
| App not subscribed to Customs Declarations **1.0** | Add 1.0 subscription in Developer Hub |
| Scope has typo | Must be exactly `write:customs-declaration` (singular, no trailing s) |
| `redirect_uri` not registered | Add `http://localhost:3000/auth/hmrc/callback` to Developer Hub redirect URIs |
| Test user created via Developer Hub UI | Must use Create Test User API with `customs-services` |
| Application not on TDR allowlist | Email TDRcommunications@hmrc.gov.uk |

---

## 5. HTTP Headers Reference

### Submission Headers (all HMRC endpoints)

| Header | Value | Notes |
|--------|-------|-------|
| `Authorization` | `Bearer {access_token}` | Required |
| `Accept` | `application/vnd.hmrc.2.0+xml` | Required; 406 if wrong |
| `Content-Type` | `application/xml; charset=UTF-8` | Required for POST |
| `X-Conversation-ID` | Auto-assigned by HMRC | Returned in 202 response |

### Fraud Prevention Headers (injected by `hmrc-fetch.ts`)

| Header | Example | Notes |
|--------|---------|-------|
| `Gov-Client-Connection-Method` | `WEB_APP_VIA_SERVER` | Always this value |
| `Gov-Client-Device-ID` | UUID per device | Persisted client-side |
| `Gov-Client-User-IDs` | `os={clerkId}` | |
| `Gov-Client-Timezone` | `UTC+00:00` | |
| `Gov-Client-Window-Size` | `width=1920&height=1080` | |
| `Gov-Client-Screens` | `width=1920&height=1080&...` | |
| `Gov-Client-Browser-JS-User-Agent` | navigator.userAgent | |
| `Gov-Client-Browser-Do-Not-Track` | `false` | |
| `Gov-Vendor-Version` | `freightcode=1.0.0` | |
| `Gov-Vendor-Public-IP` | `62.31.164.236` | Server IP, not client |
| `Gov-Client-Public-IP` | Client IP forwarded | |

**Note:** `Gov-Client-Local-IPs` is intentionally omitted — HMRC's WAF rejects private IP addresses for `WEB_APP_VIA_SERVER` connection method.

### Trade Test Only (NOT TDR)

| Header | Value | When to include |
|--------|-------|-----------------|
| `Gov-Test-Scenario` | `HAPPY_PATH` | **Trade Test sandbox ONLY** |

> **CRITICAL:** Remove `Gov-Test-Scenario` for TDR submissions. TDR does not accept this header and its presence may cause rejection. Set `HMRC_TEST_SCENARIO=` (empty) in `.env.local` before any TDR submission.

---

## 6. WCO XML Payload Specification

### Namespace Declarations

```xml
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationCode>DMS</AgencyAssignedCustomizationCode>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2"
               xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:6"
               xmlns:p1="urn:wco:datamodel:WCO:Declaration_DS:DMS:2"
               xmlns:md="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
    ...
  </Declaration>
</MetaData>
```

### Mandatory Data Elements — H1 Import (IMA)

```
Declaration level (42A):
  FunctionCode          = "9"                    (DE 1/1)
  FunctionalReferenceID = {LRN}                  (DE 1/2 — your internal ref)
  TypeCode              = "IMA"                  (DE 1/4 — frontier import)
  GoodsItemQuantity     = {count}                (DE 1/9)
  TotalGrossMassMeasure unitCode="KGM" = {kg}    (DE 6/5)
  TotalPackageQuantity  = {packages}             (DE 6/18)
  InvoiceAmount currencyID="{ISO4217}" = {value} (DE 4/11)
  DeclarationOfficeID   = {port code}            (DE 3/34)

Parties:
  Declarant/ID          = {GB + 12 digits EORI}  (DE 3/18 — mandatory)
  Importer/ID           = {GB + 12 digits EORI}  (DE 3/15 — mandatory)
  Exporter/ID           = {GB/XI EORI only}      (DE 3/2 — OMIT if overseas exporter)

GoodsShipment (67A):
  UCR/TraderAssignedReferenceID = {DUCR}         (DE 2/1)
  Consignment/ContainerCode     = "0"/"1"        (DE 7/2)
  Consignment/BorderTransportMeans/...           (DE 7/4, 7/5)
  Consignment/GoodsLocation/...                  (DE 5/23)
  Destination/CountryCode       = "GB"           (DE 5/8)
  ExportCountry/ID              = {dispatch ISO} (DE 5/14 — NEVER "GB" for overseas import)
  Importer element              (see above)
  TradeTerms/ConditionCode      = {Incoterms}    (DE 4/1)
  TradeTerms/LocationID         = {port code}

GovernmentAgencyGoodsItem (68A) — per item:
  SequenceNumeric              = {1, 2, 3...}
  StatisticalValueAmount       = {value}         (DE 4/14)
  Commodity/Description        = {text}          (DE 6/8)
  Commodity/Classification[0]/ID = {10-digit HS} (DE 6/14 — ItemTypeCode=TSP)
  Commodity/GoodsMeasure/NetNetWeightMeasure     (DE 6/1)
  Commodity/GoodsMeasure/TariffQuantity          (DE 6/2 if supplementary units needed)
  AdditionalDocument[]         (DE 2/3 — see §7)
  GovernmentProcedure[0]       (DE 1/10 — CurrentCode + PreviousCode)
  GovernmentProcedure[1]       (DE 1/11 — CurrentCode only)
  Origin/CountryCode           = {ISO country}   (DE 5/16)
  Packaging/SequenceNumeric, TypeCode, QuantityQuantity, MarksNumbersID
  GoodsMeasure/GrossMassMeasure                  (DE 6/5 at item level)
```

### GovernmentProcedure Encoding (DE 1/10 and DE 1/11)

For `procedureCode="4000"` and `additionalProcedureCode="000"`:

```xml
<!-- DE 1/10: split the 4-char CPC into 2+2 -->
<GovernmentProcedure>
  <CurrentCode>40</CurrentCode>    <!-- chars 0-1: requested procedure -->
  <PreviousCode>00</PreviousCode>  <!-- chars 2-3: previous procedure -->
</GovernmentProcedure>

<!-- DE 1/11: 3-char additional procedure code, separate element, no PreviousCode -->
<GovernmentProcedure>
  <CurrentCode>000</CurrentCode>
</GovernmentProcedure>
```

**Common additional procedure codes:**
| Code | Meaning |
|------|---------|
| `000` | No additional procedure (standard home use) |
| `100` | Customs Duty relief |
| `200` | Preference (reduced duty via trade agreement) |
| `1CS` | Customs Comprehensive Guarantee |

### DUCR Format (DE 2/1)

```
{year_digit}GB{12-digit-EORI-without-GB}-{trader-reference}

Example: 6GB449181054677-ABC123456
         ^                ^
         └─ last digit of year (2026→6)
                          └─ EORI without "GB" prefix
```

Rules:
- `year_digit`: `new Date().getFullYear() % 10`
- EORI part: strip `GB` prefix, leave the 12 digits
- Trader reference: alphanumeric, no spaces, typically 6-10 chars
- Total max length: 35 characters

### ExportCountry vs GoodsLocation

| Element | DE | Meaning | Example |
|---------|-----|---------|---------|
| `ExportCountry/ID` | 5/14 | Dispatch country (where goods shipped FROM) | `BR` for Brazil |
| `Destination/CountryCode` | 5/8 | Destination country | `GB` always for UK imports |
| `GoodsLocation/ID` | 5/23 | Physical UK location of goods at declaration | `GBAUFXTFXTGW` (Felixstowe) |
| `GoodsLocation/Name` | 5/23 | Location name code | `GBWLAFXTFXTGW` |

> ExportCountry must **never** be `GB` for a third-country import. Must be the actual dispatch country (e.g. `BR`, `US`, `CN`).

### Importer / Declarant / Exporter Rules

| Party | DE | Rule |
|-------|----|------|
| `Declarant/ID` | 3/18 | Always required. Your EORI (the entity submitting). `GB` + 12 digits. |
| `Importer/ID` | 3/15 | Required. The importer's EORI. Can be same as Declarant. |
| `Exporter/ID` | 3/2 | **Include ONLY if exporter has a GB/XI EORI.** Omit entirely for overseas exporters. |

### XML Element Ordering (xs:sequence — must be exact)

Declaration level order:
```
FunctionCode → FunctionalReferenceID → TypeCode → GoodsItemQuantity →
DeclarationOfficeID → InvoiceAmount → TotalGrossMassMeasure →
TotalPackageQuantity → Declarant → [Exporter conditional] → GoodsShipment
```

GoodsShipment order:
```
UCR → Consignment → Destination → ExportCountry → Importer →
TradeTerms → GovernmentAgencyGoodsItem[]
```

GovernmentAgencyGoodsItem order:
```
SequenceNumeric → StatisticalValueAmount → AdditionalDocument[] →
Commodity → GovernmentProcedure[DE1/10] → GovernmentProcedure[DE1/11] →
Origin → Packaging → [other elements]
```

---

## 7. AdditionalDocument Matrix — HS 0207129000

**Commodity:** Frozen whole poultry (HS 0207129000)  
**Procedure:** 4000 000 (release to free circulation, no previous procedure)  
**Origin:** BR (Brazil)  
**Declaration type:** IMA (frontier import)

### Required Documents

| Document Code | CategoryCode | TypeCode | StatusCode | ID Format | Reason |
|--------------|-------------|---------|-----------|-----------|--------|
| **N853** | `N` | `853` | `XW` | `GBCHD{YYYY}.{reference}` | CHED-P — mandatory for all 3rd-country animal product imports (veterinary/SPS measure) |
| **Y930** | `Y` | `930` | `XB` | `Excluded` | Commission Decision 2007/275/EC — exclusion declaration (goods not subject to certain veterinary checks) |
| **Y929** | `Y` | `929` | `XB` | `Excluded` | Non-organic goods — exemption from organic certification requirement |

### N853 Status Code History (CRITICAL)

| Period | Status Code | Notes |
|--------|------------|-------|
| Pre-Oct 2025 | `AE` or `XX` | Widely used |
| **23 Oct 2025 onwards** | **`XW`** | `XX` removed; `AE` no longer valid for CHED-P |
| TDR 2026 | **`XW`** | Current correct value — your code is correct |

Reference: [HMRC CHED status code changes, Oct 2025](https://www.internationaltradehub.co.uk/post/hmrc-confirms-changes-to-ched-document-codes-on-declarations)

### N853 CHED Reference Format

```
GBCHD{YYYY}.{IPAFFS-reference}
Example: GBCHD2026.1234567
```

> **TDR WARNING:** BTMS/IPAFFS integration with CDS went live **12 June 2025**. In TDR, HMRC **may** cross-validate the N853 CHED reference against IPAFFS. A synthetic/placeholder reference (`GBCHD2026.1234567`) may cause CDS12050 if IPAFFS validation is active in TDR. Confirm with TDRcommunications@hmrc.gov.uk whether live CHED reference validation is active in TDR before submission.

### XML Snippet — All Three Documents

```xml
<AdditionalDocument>
  <CategoryCode>N</CategoryCode>
  <ID>GBCHD2026.1234567</ID>
  <TypeCode>853</TypeCode>
  <LPCOExemptionCode>XW</LPCOExemptionCode>
</AdditionalDocument>
<AdditionalDocument>
  <CategoryCode>Y</CategoryCode>
  <ID>Excluded</ID>
  <TypeCode>930</TypeCode>
  <LPCOExemptionCode>XB</LPCOExemptionCode>
</AdditionalDocument>
<AdditionalDocument>
  <CategoryCode>Y</CategoryCode>
  <ID>Excluded</ID>
  <TypeCode>929</TypeCode>
  <LPCOExemptionCode>XB</LPCOExemptionCode>
</AdditionalDocument>
```

> Note: In the WCO XML the `StatusCode` field maps to `<LPCOExemptionCode>` in the CDS profile.

### Verify Against Live Tariff

The document requirements and permitted status codes update with tariff changes. Always verify before submission:

```
https://www.trade-tariff.service.gov.uk/commodities/0207129000?country=BR
```

---

## 8. Error Codes & Root Causes

### DMSREJ Error Pointer Structure

```xml
<Pointer>
  <DocumentSectionCode>42A</DocumentSectionCode>  <!-- Declaration level -->
</Pointer>
<Pointer>
  <DocumentSectionCode>67A</DocumentSectionCode>  <!-- GoodsShipment level -->
</Pointer>
<Pointer>
  <DocumentSectionCode>68A</DocumentSectionCode>  <!-- GovernmentAgencyGoodsItem -->
  <SequenceNumeric>1</SequenceNumeric>            <!-- Item number (1-based) -->
</Pointer>
<Pointer>
  <DocumentSectionCode>70A</DocumentSectionCode>  <!-- GovernmentProcedure -->
</Pointer>
```

| Pointer Chain | Meaning |
|---------------|---------|
| `42A → 67A → 68A` | Error at goods item level (DE 2/3 documents, commodity, origin) |
| `42A → 67A → 68A → 70A` | Error at procedure code level (DE 1/10 / DE 1/11) |
| `42A` only | Declaration header level error |

### CDS Error Code Reference

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| **CDS12050** | Missing mandatory document code | A document code required by the procedure/commodity combination is absent from AdditionalDocument[] | Add the missing document code(s) per the tariff tool. N853 StatusCode `XW` from Oct 2025. |
| **CDS12056** | Incompatible code combination | Procedure code + additional procedure code + document code combination is not permitted together | Check DE 1/10 Appendix 1 for valid combinations. CDS12056 was split into 48 sub-codes. |
| **CDS10020** | Missing mandatory field | A required data element is absent | Add the missing field per the WCO DEC-DMS 2 schema |
| **CDS12006** | Invalid EORI format | EORI doesn't match `GB\d{12}` | Ensure EORI is `GB` + exactly 12 digits |
| **CDS12125** | Duty deferment account not recognised | DAN not enrolled for the declarant EORI | Use a valid DAN for the test EORI |
| **CDS12136** | Invalid country code | ISO 3166-1 alpha-2 code not recognised | Check ExportCountry, Origin, Destination |

### CDS12050 — Current Blocker

**Root cause analysis for HS 0207129000 / CPC 4000 000 / origin BR:**

1. **N853 StatusCode wrong** — if using `AE` or `XX` instead of `XW` (changed Oct 2025)
2. **N853 CHED reference not validated by IPAFFS** — BTMS live since June 2025; synthetic references may fail
3. **Missing Y930 or Y929** — if either exclusion document is absent
4. **Wrong Y-code status** — verify `XB` is correct for Y929/Y930 via Appendix 5A

**Next step:** Email TDRcommunications@hmrc.gov.uk with your LRN and exact DMSREJ XML to get HMRC's diagnosis. They can confirm whether IPAFFS validation is active and whether the CHED reference is being checked.

---

## 9. Notification Flow

### Message Sequence — Standard IMA Frontier Import

```
Trader                              HMRC CDS
  │                                     │
  │── POST /customs/declarations ───────►│
  │◄─ 202 Accepted + X-Conversation-ID ─│
  │                                     │ (async processing ~seconds)
  │◄─ DMSACC ───────────────────────────│  Declaration accepted
  │                                     │ (~10 minutes for duty calc)
  │◄─ DMSTAX ───────────────────────────│  Duty/tax assessment
  │                                     │ (after checks/payment)
  │◄─ DMSCLE ───────────────────────────│  Cleared — goods released
```

### All Notification Types

| Code | Meaning | When |
|------|---------|------|
| `DMSACC` | Declaration accepted | Immediately on acceptance |
| `DMSTAX` | Tax/duty calculation | ~10 min after DMSACC for arrived declarations |
| `DMSDOC` | Document required | Any time before clearance |
| `DMSCLE` | Cleared / goods released | After duty paid and checks complete |
| `DMSINV` | Invalidated / cancelled | On successful cancellation |
| `DMSREJ` | Rejected | Business rule or schema failure |
| `DMSEOG` | Goods exited UK | Exports only |

### Push vs Pull

**Push (webhook):**
- HMRC POSTs to `HMRC_REDIRECT_URI` (your `/api/hmrc/webhooks/notify` endpoint)
- Authenticated via `Authorization: Bearer {HMRC_WEBHOOK_AUTH_TOKEN}`
- Your handler validates token, parses XML, saves to `notifications` table
- HMRC retries failed pushes for up to 14 days

**Pull (recommended for TDR):**
```
GET /notifications/conversationId/{conversationId}/unpulled
  → returns list of {notificationId, …}

GET /notifications/unpulled/{notificationId}
  → returns notification XML body
```
- Poll until empty (all notifications retrieved)
- Pulled notifications are marked and purged after 14 days

**ConversationId** — returned in `X-Conversation-ID` response header on the 202. This is the primary tracking handle. Store immediately on submission (your submit route does this correctly).

### Notification Storage Rules

- `notifications` table is **immutable append-only** — never update or delete rows
- `notificationType` derived only from HMRC-sourced DMS* events — never synthesise
- `rawPayload` stored verbatim — this is the audit chain
- Status authority order: DMS code string → `<NameCode>` element → `<FunctionCode>` numeric fallback

---

## 10. Trade Test vs TDR — Key Differences

| Feature | Trade Test (Sandbox) | TDR |
|---------|---------------------|-----|
| Access | All registered apps | Requires HMRC allowlisting |
| `Gov-Test-Scenario` header | **Required** to drive outcomes | **Must be absent** |
| Test outcomes | Header-controlled | Declaration-content-driven |
| CHED/IPAFFS validation | Not active | **May be active** (BTMS live June 2025) |
| Notification realism | Simulated | Mirrors production |
| Evidence for Recognised Software | Not counted | Counted |
| URL base | `test-api.service.hmrc.gov.uk` | Same URL, routing by allowlist |
| Accept header | `application/vnd.hmrc.2.0+xml` | Same |

**Action required before TDR:** Set `HMRC_TEST_SCENARIO=` (blank) in `.env.local`

---

## 11. Codebase Gap Analysis

### Critical Issues

| Issue | File | Severity | Details |
|-------|------|----------|---------|
| `additionalProcedureCode` not in schema | `convex/schema.ts` line 77 | CRITICAL | Field not stored; no UI input; always defaults to `"000"` in XML. Declarations needing any other code (100, 200, 1CS) will silently submit wrong data. |
| `additionalProcedureCode` no UI input | `goods_items` page | CRITICAL | No field exists to enter this in the declaration UI |
| `Gov-Test-Scenario` injected for TDR | `hmrc-fetch.ts` | HIGH | Must be absent for TDR. Remove/empty `HMRC_TEST_SCENARIO` env var before TDR submission |
| N853 CHED reference synthetic | `run-hmrc-scenarios.js` line 33 | HIGH | `GBCHD2026.1234567` placeholder may fail IPAFFS cross-validation in TDR |

### Medium Issues

| Issue | File | Severity | Details |
|-------|------|----------|---------|
| `ExportCountry` defaults to `"US"` | `wco-mapper.ts` | MEDIUM | `declaration.dispatchCountry \|\| "US"` — if field blank, sends wrong dispatch country |
| No XSD schema validation | `submit/route.ts` | MEDIUM | `validateXmlPreflight()` does pattern checks only; structural/cardinality errors won't be caught locally |
| `additionalDocuments` UI capped at 3 slots | items page | MEDIUM | WCO allows unlimited; some commodities need more than 3 |
| Transport mode hardcoded to `"1"` (sea) | `wco-mapper.ts` line 138 | MEDIUM | No UI field to override for air/rail/road cargo |
| `ContainerCode` hardcoded to `"0"` | `wco-mapper.ts` line 133 | LOW | Cannot specify containerised shipments |

### Confirmed Correct

| Item | File | Status |
|------|------|--------|
| `Accept: application/vnd.hmrc.2.0+xml` | `hmrc-fetch.ts` | ✅ Correct |
| GovernmentProcedure split (DE 1/10 two-element, DE 1/11 separate) | `wco-mapper.ts` | ✅ Correct |
| Exporter element conditional on GB/XI EORI regex | `wco-mapper.ts` | ✅ Correct |
| DUCR format `{year%10}GB{eori_without_prefix}-{ref}` | `wco-mapper.ts` | ✅ Correct |
| N853 StatusCode `XW` (post Oct 2025) | `run-hmrc-scenarios.js` | ✅ Correct |
| Token refresh at 5-min pre-expiry window | `submit/route.ts` | ✅ Correct |
| `X-Conversation-ID` stored immediately after 202 | `submit/route.ts` | ✅ Correct |
| Notifications table immutable append-only | `convex/notifications.ts` | ✅ Correct |
| `Gov-Client-Local-IPs` intentionally omitted | `hmrc-fetch.ts` | ✅ Correct (WAF blocks private IPs) |
| Fraud header validation (7 required headers) | `hmrc-fetch.ts` | ✅ Correct |
| OAuth state parameter carries `userId` | `auth/route.ts` | ✅ Correct |

---

## 12. TDR Submission Checklist

### Before First TDR Submission

- [ ] Email TDRcommunications@hmrc.gov.uk to request allowlisting (provide Application ID)
- [ ] Add **Customs Declarations 1.0** subscription in Developer Hub (not 2.0 Beta)
- [ ] Register `http://localhost:3000/auth/hmrc/callback` as redirect URI in Developer Hub
- [ ] Create test user via Create Test User API (`/create-test-user/organisations` with `customs-services`)
- [ ] Complete OAuth flow: sign into app → `/api/hmrc/auth` → HMRC Gateway → callback stores token
- [ ] Set `HMRC_EORI` to test user EORI in `.env.local`
- [ ] Set `HMRC_TEST_SCENARIO=` (blank/empty) — **must not be present for TDR**
- [ ] Confirm CHED reference validity with TDRcommunications@hmrc.gov.uk

### Dry-Run Gate (mandatory before every live TDR submission)

```bash
node test-evidence/run-hmrc-scenarios.js
# Check: test-evidence/tdr-cds-v1-dry-run.json — all checks must pass
```

Dry-run checks:
- `eori_format_valid` — GB + 12 digits
- `token_present` — OAuth token in Convex
- `goods_items_exist` — at least 1 item
- `additional_documents_present` — N853, Y930, Y929 all present
- `xml_valid` — preflight structure check
- `no_test_scenario_header` — HMRC_TEST_SCENARIO must be empty

### TDR Live Submission (one controlled submit)

```bash
DRY_RUN_ONLY=false HMRC_SUBMIT_ONCE=true node test-evidence/run-hmrc-scenarios.js
```

Evidence files written:
- `test-evidence/tdr-cds-v1-request.xml` — exact XML sent
- `test-evidence/tdr-cds-v1-response.xml` — HMRC 202 response
- `test-evidence/scenario-summary.json` — metadata + conversation ID

### Post-Submission

- [ ] Record `X-Conversation-ID` from response
- [ ] Wait for DMSACC (push webhook or pull `/notifications/conversationId/{id}/unpulled`)
- [ ] Wait for DMSTAX
- [ ] Wait for DMSCLE
- [ ] Save all notification XMLs as evidence
- [ ] Confirm `notifications` table has full chain: DMSACC → DMSTAX → DMSCLE

---

## 13. Reference URLs

| Resource | URL |
|----------|-----|
| CDS End-to-End Service Guide | https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/ |
| Developer Setup | https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/set-up-developers.html |
| Submit a Declaration | https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/submitting-import-and-export-customs-declarations.html |
| Notifications Guide | https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/notifications.html |
| Path to Production 2024 (PDF) | https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/resources/The_Path_to_Production_2024.pdf |
| Using TDR (GOV.UK) | https://www.gov.uk/guidance/using-the-trader-dress-rehearsal-service |
| CDS Error Codes | https://www.gov.uk/government/publications/customs-declaration-service-error-codes |
| Known CDS Error Workarounds | https://www.gov.uk/government/publications/known-error-workarounds-for-the-customs-declaration-service-cds |
| CDSSG12050 (doc requirements per CPC) | https://www.gov.uk/hmrc-internal-manuals/customs-cds-volume-3-tariff-step-by-step-guide/cdssg12050 |
| DE 1/10 Appendix 1 — Procedure Code 40 | https://www.gov.uk/government/publications/appendix-1-de-110-requested-and-previous-procedure-codes-of-the-customs-declaration-service-cds/requested-procedure-40-release-to-free-circulation |
| DE 2/3 Union Document Codes (Appendix 5A) | https://www.gov.uk/government/publications/data-element-23-documents-and-other-reference-codes-union-of-the-customs-declaration-service-cds |
| Pull Notifications API | https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/api-notification-pull/1.0 |
| Commodity Lookup (HS 0207129000, BR) | https://www.trade-tariff.service.gov.uk/commodities/0207129000?country=BR |
| CHED Status Code Changes Oct 2025 | https://www.internationaltradehub.co.uk/post/hmrc-confirms-changes-to-ched-document-codes-on-declarations |
| HMRC GitHub — customs-declarations | https://github.com/hmrc/customs-declarations |
| HMRC GitHub — customs-declarations-information | https://github.com/hmrc/customs-declarations-information |
| TDR Contact | TDRcommunications@hmrc.gov.uk |
| Developer Support | SoftwareDeveloperSupport@hmrc.gov.uk |
