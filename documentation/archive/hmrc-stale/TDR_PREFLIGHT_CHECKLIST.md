# TDR Pre-Flight Checklist - CRITICAL

⚠️ **WARNING**: You only get a few chances at TDR. HMRC actively monitors and uses this to approve/reject production access. Complete this checklist BEFORE submitting to TDR.

## ✅ Technical Requirements (27/27 PASSED)

- [x] All API endpoints operational
- [x] All 8 webhook handlers working
- [x] Accept header = application/vnd.hmrc.1.0+xml
- [x] XML sanitization implemented
- [x] Rate limiting (3 req/s)
- [x] HTTP 500/503 retry logic
- [x] All 10 declaration types supported
- [x] OAuth URLs env-driven
- [x] Health check endpoint
- [x] Environment switchable
- [x] Runbook documentation

## ⚠️ CRITICAL Pre-TDR Checks

### 1. Environment Configuration
- [ ] `.env.local` updated:
  - `HMRC_ENVIRONMENT=production`
  - `HMRC_DECLARATIONS_ACCEPT=application/vnd.hmrc.1.0+xml`
  - `HMRC_EORI=GB553202734852` (or your approved test EORI)
- [ ] Dev server restarted after env changes
- [ ] Verified environment variables loaded correctly

### 2. HMRC Developer Hub
- [ ] Application registered for TDR/Production environment
- [ ] Production CLIENT_ID and CLIENT_SECRET obtained
- [ ] Callback URL updated to production URL (not localhost)
- [ ] All required scopes enabled:
  - `write:customs-declaration`
  - `write:customs-declarations-information`
- [ ] Application status = "Active" in Developer Hub

### 3. OAuth Token
- [ ] Valid OAuth token obtained via production flow
- [ ] Token stored in Convex database
- [ ] Token not expired (check expiresAt)
- [ ] Refresh token available
- [ ] Test token refresh works

### 4. Test Data Quality
- [ ] Using HMRC-approved test EORI (GB553202734852)
- [ ] Valid commodity codes (e.g., 0207129000)
- [ ] Realistic values and weights
- [ ] Valid procedure codes (4000, 4071, etc.)
- [ ] Proper DUCR format: 9GB{EORI}-{unique-ref}
- [ ] Valid country codes (ISO 3166-1 alpha-2)
- [ ] Realistic invoice amounts
- [ ] Valid package types and counts

### 5. Declaration Payload Validation
- [ ] All mandatory fields populated
- [ ] No placeholder or dummy data ("Test", "12345", etc.)
- [ ] Dates in correct format (YYYYMMDD)
- [ ] Weights in KGM (kilograms)
- [ ] Currency codes valid (GBP, USD, EUR)
- [ ] EORI format: GB + 12 digits
- [ ] Commodity codes: 10 digits
- [ ] Procedure codes: 7 digits (4+3)

### 6. End-to-End Flow Testing
- [ ] Can create declaration in UI
- [ ] Can submit to HMRC (test in sandbox first if unsure)
- [ ] Webhook endpoint accessible from internet
- [ ] Can receive DMSACC notification
- [ ] Can handle DMSROG (route to examine)
- [ ] Can upload documents if requested
- [ ] Can handle DMSCLE (cleared)
- [ ] Can handle DMSREJ (rejected)

### 7. Error Handling
- [ ] Graceful handling of 400 errors
- [ ] Automatic retry on 429 (rate limit)
- [ ] Automatic retry on 500/503
- [ ] Clear error messages to user
- [ ] Errors logged for debugging

### 8. Fraud Prevention Headers
- [ ] Gov-Client-Connection-Method set
- [ ] Gov-Vendor-Version set
- [ ] Gov-Vendor-Product-Name set
- [ ] Gov-Client-Public-IP captured
- [ ] Gov-Client-Timezone forwarded
- [ ] Gov-Client-Window-Size forwarded
- [ ] Gov-Client-Screens forwarded

### 9. Volume and Behavior
- [ ] Plan to submit 2-5 declarations only (not 50+)
- [ ] Space submissions out (not all at once)
- [ ] Use different scenarios:
  - 1x Happy path (should clear)
  - 1x Route to examine (with document upload)
  - 1x Rejection scenario (to show error handling)
- [ ] No automated test suites running
- [ ] No load testing

### 10. Documentation Ready
- [ ] Runbook accessible
- [ ] Support contact information ready
- [ ] Architecture diagram available
- [ ] Can explain your implementation to HMRC if asked

## 🚨 STOP - Do Not Proceed If:

- [ ] Any technical test failed (must be 27/27)
- [ ] No valid OAuth token
- [ ] Using localhost callback URL
- [ ] Using dummy/test data
- [ ] Haven't tested in sandbox first
- [ ] Webhook endpoint not publicly accessible
- [ ] Planning to submit >10 declarations
- [ ] Running automated tests against TDR

## ✅ Final Verification

Before submitting to TDR:

1. **Run TDR Readiness Test One More Time**:
   ```bash
   node scripts/tdr-readiness-test.js
   ```
   Must show: 27/27 PASS (100%)

2. **Verify Environment**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   Should return: `"environment":"production"`

3. **Test OAuth Token**:
   - Check Convex database for valid token
   - Verify expiresAt is in future
   - Test token refresh if near expiry

4. **Review Test Declaration**:
   - Print out the XML payload
   - Manually verify all fields
   - Check against HMRC schema

## 📋 TDR Submission Plan

### Scenario 1: Happy Path
- EORI: GB553202734852
- Commodity: 0207129000 (Plucked Chickens)
- Value: £5,000
- Weight: 100 KGM
- Origin: AR (Argentina)
- Procedure: 4000
- Expected: DMSACC → DMSCLE

### Scenario 2: Route to Examine
- EORI: GB553202734852
- Commodity: 0207129000
- Value: £15,000
- Weight: 300 KGM
- Origin: AR
- Procedure: 4000
- Expected: DMSACC → DMSROG → Upload Document → DMSCLE

### Scenario 3: Rejection (Optional)
- Use invalid commodity code or missing field
- Expected: DMSREJ with error details
- Shows error handling works

## 📞 Emergency Contacts

- HMRC Developer Support: https://developer.service.hmrc.gov.uk/devhub-support/
- HMRC API Status: https://api-platform-status.production.tax.service.gov.uk/

## ✅ Sign-Off

- [ ] All checklist items completed
- [ ] Team reviewed and approved
- [ ] Ready for TDR submission

**Date**: _______________
**Approved By**: _______________

---

**Remember**: TDR is your final exam. HMRC is watching. Quality over quantity. 2-5 perfect declarations beats 50 rushed ones.