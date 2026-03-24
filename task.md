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

## Stage 2: Trader Dress Rehearsal (TDR) — NEXT
- [x] Refactored 5 HMRC API routes to use `fetchHmrc` wrapper (Fraud Prevention Headers)
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
- [ ] Confirm clearance flow end-to-end (DMSACC → DMSROG → DMSCLE)
