# HMRC Fraud Prevention Headers Implementation Plan

## Goal Description
The application is missing mandatory **HMRC Fraud Prevention Headers**. While the Sandbox environment does not strictly enforce these, the Trader Dress Rehearsal (TDR) and Production environments actively reject requests without valid `Gov-Client-*` headers. This plan outlines how we added them to all HMRC API calls across the app.

## Implemented Changes

### 1. Client-Side Data Collection
#### [NEW] `src/lib/hmrc-fraud-headers.ts`
Provided a client-side utility to collect standard HMRC-required metrics:
* `Gov-Client-Timezone`
* `Gov-Client-Window-Size`
* `Gov-Client-Screens`
* `Gov-Client-Browser-JS-User-Agent`

### 2. Backend Fetch Wrapper
#### [NEW] `src/lib/hmrc-fetch.ts`
Created a unified wrapper `fetchHmrc(url, options, req)` that centralizes auth injection and automatically attaches:
* `Gov-Client-Connection-Method: WEB_APP_VIA_SERVER`
* `Gov-Client-Public-IP`: extracted from the incoming Next.js request.
* `Gov-Vendor-Version`: Set to `TradeDNA=1.0.0`.
* The device headers passed from the frontend.

### 3. API Route Refactoring (The 5 Major Code Updates)
Updated all HMRC API routes to use the new `fetchHmrc` wrapper instead of raw `fetch()`. Handled the centralized management for the following 5 target files:
#### [MODIFIED] `src/app/api/hmrc/submit/route.ts`
#### [MODIFIED] `src/app/api/hmrc/amend/route.ts`
#### [MODIFIED] `src/app/api/hmrc/cancel/route.ts`
#### [MODIFIED] `src/app/api/hmrc/documents/initiate/route.ts`
#### [MODIFIED] `src/app/api/hmrc/upload/route.ts`
