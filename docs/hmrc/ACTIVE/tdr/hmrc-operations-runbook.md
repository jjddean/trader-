# FreightCode CDS Operations Runbook

## Overview
This runbook covers common support scenarios for the FreightCode Customs Declaration Service (CDS) integration with HMRC.

---

## 1. HMRC OAuth Token Issues

### Symptom: "HMRC OAuth Token not found"
**Cause:** User hasn't connected their HMRC account, or token has been deleted.
**Fix:** Navigate to Dashboard → Settings → Security → HMRC OAuth → Connect/Reconnect.

### Symptom: "Failed to refresh HMRC token"
**Cause:** Refresh token expired (typically after 18 months) or has been revoked.
**Fix:** User must re-authorise by clicking "Reconnect" on the Settings page.

### Symptom: Token expires during long operation
**Cause:** Access tokens expire after 4 hours. A 5-minute buffer is enforced before auto-refresh.
**Fix:** Automatic — the system refreshes before expiry. If manual intervention needed, reconnect via Settings.

---

## 2. Declaration Submission Errors

### HMRC returns HTTP 400
**Cause:** Invalid XML payload — missing required fields or wrong format.
**Action:**
1. Check Convex `notifications` table for field-level errors (DMSINV/DMSREJ)
2. Review the XML payload structure against WCO 3.6 DMS schema
3. Common issues: missing EORI, invalid commodity code, bad country code

### HMRC returns HTTP 429
**Cause:** Rate limit exceeded (max 3 requests/second).
**Action:** System auto-retries with 2s → 5s backoff. If persistent, check for concurrent users causing bursts.

### HMRC returns HTTP 500/503
**Cause:** HMRC service outage.
**Action:**
1. Check [HMRC Service Availability](https://api-platform-status.production.tax.service.gov.uk/)
2. System will retry automatically
3. If prolonged, notify traders of delay

---

## 3. Notification Issues

### Push notifications not arriving
**Possible causes:**
- Callback URL not registered with HMRC
- Callback endpoint returning non-200 status
- HMRC delivery retries exhausted

**Action:**
1. Check server logs for webhook errors
2. Use pull notifications as fallback: GET `/api/hmrc/notifications/pull?conversationId={id}`
3. Contact HMRC Software Developer Support if push URL needs updating

### Declaration stuck in "Processing"
**Cause:** Notification may have been missed or delayed.
**Action:**
1. Use status query: GET `/api/hmrc/status-query?mrn={mrn}`
2. Use pull notifications to check for any missed updates
3. HMRC typically processes within minutes, but can take up to 2 hours during peak

---

## 4. Common HMRC Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| CDS12014 | Invalid commodity code | Verify 10-digit HS code against UK Trade Tariff |
| CDS12015 | Invalid EORI | Check EORI format (GB + 12 digits) and HMRC registration |
| CDS12006 | Invalid procedure code | Verify CPC format (4-digit current + 3-digit previous) |
| CDS10020 | Missing mandatory field | Check payload against WCO DMS schema |
| INVALID_CREDENTIALS | OAuth token invalid | Reconnect HMRC OAuth via Settings |

---

## 5. Environment Configuration

| Setting | Sandbox | TDR/Production |
|---------|---------|----------------|
| `HMRC_ENVIRONMENT` | `sandbox` | `production` |
| `HMRC_DECLARATIONS_ACCEPT` | `application/vnd.hmrc.2.0+xml` | Code default is v2.0; keep set explicitly in both environments |
| Token URL | `test-api.service.hmrc.gov.uk` | `api.service.hmrc.gov.uk` |
| Declaration URL | `test-api.service.hmrc.gov.uk` | `api.service.hmrc.gov.uk` |

**To switch to Production:** Set `HMRC_ENVIRONMENT=production` and keep `HMRC_DECLARATIONS_ACCEPT=application/vnd.hmrc.2.0+xml` (v2.0 is used in both environments).

---

## 6. Escalation

1. **Internal:** Check Convex dashboard for stored webhook payloads and error logs
2. **HMRC Support:** Contact via [Developer Hub Support](https://developer.service.hmrc.gov.uk/devhub-support/)
3. **Service Status:** Monitor at [HMRC API Platform Status](https://api-platform-status.production.tax.service.gov.uk/)
