# Path to Production

Ref: [HMRC Path to Production](https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/set-up-developers.html)

## Stage 1: Sandbox (Trade Test) — ✅ DONE
- [x] Register application on HMRC Developer Hub
- [x] Subscribe to Customs Declarations API (v2.0)
- [x] OAuth 2.0 auth code flow working
- [x] Submit declarations — endpoint working
- [x] Receive push notifications — all 8 types handled
- [x] Document upload flow — endpoint working
- [x] All 27/27 internal readiness tests passing

## Stage 2: Trader Dress Rehearsal (TDR) — FUTURE (requires HMRC allowlisting; not currently active)
- [x] Refactored 5 HMRC API routes to use `fetchHmrc` wrapper (Fraud Prevention Headers)
- [x] Refactor remaining HMRC routes to use `fetchHmrc` (Compliance)
    - [x] `src/app/api/hmrc/status-query/route.ts`
    - [x] `src/app/api/hmrc/notifications/pull/route.ts`
- [x] Implement missing Customs Declarations Information (CDI) endpoints
    - [x] `GET /api/hmrc/information/version` (Retrieve versions)
    - [x] `GET /api/hmrc/information/full` (Retrieve full declaration)
    - [x] `GET /api/hmrc/information/search` (Search declarations)
- [ ] Request TDR access from HMRC Software Developer Support (SDH)
- [ ] Get application added to TDR allow list
- [ ] Subscribe to Customs Declarations API **v1.0** (TDR version)
- [ ] Switch `HMRC_ENVIRONMENT` from `sandbox` to TDR endpoint
- [ ] Remove `HMRC_DECLARATIONS_ACCEPT` from `.env.local` (defaults to v1.0)
- [ ] Submit test declarations against TDR (uses live trader data)
- [ ] Test amend + cancel lifecycle against TDR
- [ ] Test pull notifications against TDR
- [ ] Verify all notification types received (DMSACC→DMSCLE flow)
- [ ] Pass HMRC's TDR assurance review

## Stage 3: Production Credentials
- [ ] Request production credentials from HMRC
- [ ] HMRC reviews application and approves
- [ ] Receive production OAuth client ID + secret
- [ ] Register push notification callback URL with HMRC for production
- [ ] Set `HMRC_ENVIRONMENT=production` in production env
- [ ] Update `HMRC_CLIENT_ID` and `HMRC_CLIENT_SECRET` to production values
- [ ] Deploy to production hosting

## Stage 4: Go Live
- [ ] Submit first real declaration via production API
- [ ] Confirm DMSACC notification received
- [ ] Monitor for 24 hours — check error rates, latency
## Search & UI Enhancements
- [x] Redesign HS Code Lookup page title and description (simplified & left-aligned)
- [x] Redesign `HSCodeLookup` component search bar (make it **smaller** & compact)
- [x] Remove redundant header from `HSCodeLookup` component
## Public Page Copy Refinement
- [x] Tone down jargon on `src/app/contact/page.tsx`
- [x] Tone down jargon on `src/app/about/page.tsx`
- [x] Tone down jargon on `src/app/solutions/page.tsx`
- [x] Tone down jargon on `src/app/resources/page.tsx`
## HS Code LoRA Integration
- [x] Create `cloudagent/TRAINING_GUIDE.md` from the user's instructions
- [x] Create `cloudagent/src/prompts/girAgent.ts` with GIR-specific system prompts
- [x] Update `cloudagent/src/index.ts` to support LoRA-based GIR classification
- [x] Create `scripts/generate-training-data.mjs` to export Convex data for training
- [x] Integrate "Run AI Audit" button into Documents Dashboard
- [ ] (Waiting for User) Run Colab training and upload LoRA adapters to Cloudflare
