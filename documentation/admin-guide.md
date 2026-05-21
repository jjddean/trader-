# FreightCode — Admin Guide

## 1. Architecture Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | Dashboard, landing pages |
| Backend | Convex (serverless) | Database, mutations, queries, cron jobs |
| Auth | Clerk | User authentication, SSO, 2FA |
| Payments | Stripe | Subscriptions (Starter/Professional/Enterprise) |
| HMRC | CDS API (OAuth 2.0) | Customs declarations, notifications |
| Storage | Cloudflare R2 | Document uploads, reference data |
| Search | Typesense | HS code lookup, commodity search |
| AI | Groq (Llama 3.3), local Ollama | AI assistant, compliance analysis |
| OCR | AWS Textract | Document extraction |
| Maps | Mapbox | Trade route visualisation |

---

## 2. Environment Configuration

All config lives in `.env.local`. **Never commit this file** (`.gitignore` covers `.env.*`).

### Critical Variables

| Variable | Purpose | Where to get it |
|----------|---------|----------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex database endpoint | Convex dashboard |
| `CONVEX_DEPLOYMENT` | Convex project identifier | Convex dashboard |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth | Clerk dashboard |
| `CLERK_SECRET_KEY` | Clerk backend auth | Clerk dashboard |
| `HMRC_CLIENT_ID` | HMRC OAuth app ID | HMRC Developer Hub |
| `HMRC_CLIENT_SECRET` | HMRC OAuth secret | HMRC Developer Hub |
| `HMRC_ENVIRONMENT` | `sandbox` or `production` | Set by admin |
| `HMRC_EORI` | Default EORI number | HMRC registration |
| `HMRC_DECLARATIONS_ACCEPT` | API version header | Set `application/vnd.hmrc.2.0+xml` for sandbox, remove for production (defaults to v1.0) |
| `HMRC_SANDBOX_BASE_URL` | Sandbox HMRC API base URL | HMRC Developer Hub |
| `HMRC_PRODUCTION_BASE_URL` | Production HMRC API base URL | HMRC Developer Hub |
| `HMRC_ACCEPT_V2_XML` | HMRC v2 XML media type | HMRC API docs |
| `HMRC_ACCEPT_V2_JSON` | HMRC v2 JSON media type | HMRC API docs |
| `HMRC_ACCEPT_V1_XML` | HMRC v1 XML media type | HMRC API docs |
| `HMRC_VENDOR_PRODUCT_NAME` | Product name for Gov-Vendor headers | Set by admin |
| `HMRC_VENDOR_VERSION` | Product version for Gov-Vendor headers | Release/versioning process |
| `HMRC_TOKEN_EXPIRY_BUFFER_MS` | Token refresh buffer before expiry | Set by admin |
| `HMRC_DEFAULT_TOKEN_EXPIRY_MS` | Fallback token expiry value | Set by admin |
| `HMRC_RETRY_DELAY_RATE_LIMIT_MS` | First retry delay for HTTP 429 | Set by admin |
| `HMRC_RETRY_DELAY_SERVER_ERROR_MS` | First retry delay for transient 5xx errors | Set by admin |
| `HMRC_RETRY_DELAY_RATE_LIMIT_SECOND_MS` | Second retry delay for HTTP 429 | Set by admin |
| `HMRC_RETRY_DELAY_SERVER_ERROR_SECOND_MS` | Second retry delay for transient 5xx errors | Set by admin |
| `HMRC_REDIRECT_URI` | OAuth callback URL | Must match your deployment URL |
| `STRIPE_SECRET_KEY` | Stripe payments | Stripe dashboard |
| `GROQ_API_KEY` | AI inference | Groq console |
| `CLOUDFLARE_R2_*` | Document storage | Cloudflare dashboard |
| `TYPESENSE_API_KEY` | Search engine | Typesense Cloud |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | OCR (Textract) | AWS IAM console |

### Switching Environments (Sandbox → TDR → Production)

1. Change `HMRC_ENVIRONMENT` to `production`
2. Remove `HMRC_DECLARATIONS_ACCEPT` (defaults to v1.0 required by TDR/Production)  
3. Update `HMRC_CLIENT_ID` and `HMRC_CLIENT_SECRET` to production credentials
4. Update `HMRC_REDIRECT_URI` to your production callback URL
5. Restart the application

---

## 3. Database Schema (Convex)

| Table | Purpose | Key indexes |
|-------|---------|-------------|
| `users` | User profiles (synced from Clerk) | `by_clerk` |
| `subscriptions` | Stripe subscription status | `by_user` |
| `hmrc_tokens` | HMRC OAuth access/refresh tokens | `by_user` |
| `declarations` | Customs declarations (MRN, status, EORI) | `by_user`, `by_mrn` |
| `goods_items` | Line items within declarations | `by_declaration` |
| `documents` | Uploaded supporting documents | `by_user`, `by_mrn` |
| `notifications` | HMRC DMS notification history | `by_mrn`, `by_user` |
| `workspaces` | Multi-tenant workspaces | `by_owner` |
| `workspaceMembers` | Workspace access control | `by_user` |
| `historical_declarations` | Imported legacy declarations | `by_user` |
| `referenceDatasets` | HS codes, tariffs, currencies | `by_name` |
| `waitlist_leads` | Pre-launch waitlist | `by_email` |

**Access:** [Convex Dashboard](https://dashboard.convex.dev) → Project: `tradedna-f4430`

---

## 4. Dashboard Pages

| Page | Path | Function |
|------|------|----------|
| Home | `/dashboard` | Overview, KPIs, recent activity |
| Declarations | `/dashboard/declarations` | Create, view, manage customs declarations |
| Documents | `/dashboard/documents` | Upload and manage supporting docs |
| Reports | `/dashboard/reports` | Customs reports and analytics |
| Compliance Audit | `/dashboard/audit` | Compliance checks against declarations |
| Records | `/dashboard/records` | Historical declaration records |
| HS Code Lookup | `/dashboard/tools` | Commodity code search via Typesense |
| AI Assistant | `/dashboard/assistant` | AI-powered customs guidance |
| Settings | `/dashboard/settings` | Profile, Subscription, Security (HMRC OAuth, 2FA, API keys), Notifications |
| Admin | `/dashboard/admin` | Admin-only management panel |
| Inbox | `/dashboard/inbox` | Notification inbox |
| Prospects | `/dashboard/prospects` | CRM / lead tracking |

---

## 5. API Endpoints

### HMRC Integration

| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/api/hmrc/submit` | Submit new declaration to HMRC |
| POST | `/api/hmrc/amend` | Amend existing declaration (FunctionCode 13) |
| POST | `/api/hmrc/cancel` | Cancel/invalidate declaration (TypeCode INV) |
| GET | `/api/hmrc/status-query` | Query declaration status by MRN/DUCR/UCR |
| POST | `/api/hmrc/webhooks/notify` | Receive push notifications from HMRC |
| GET | `/api/hmrc/notifications/pull` | Pull notifications by conversationId |
| POST | `/api/hmrc/documents/initiate` | Initiate document upload to HMRC |
| POST | `/api/hmrc/upload` | Upload document to HMRC |

### System

| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/health` | Health check (returns service status) |
| GET | `/auth/hmrc/callback` | OAuth callback from HMRC |

---

## 6. HMRC Integration Details

### OAuth Flow
1. User clicks "Connect HMRC" on Settings → Security
2. Redirected to HMRC Government Gateway login
3. User authorises the app
4. Callback at `/auth/hmrc/callback` exchanges code for tokens
5. Tokens stored in `hmrc_tokens` table (encrypted via Convex)
6. Access tokens auto-refresh before expiry (4 hour lifetime)

### Notification Types

| Code | Meaning | Action |
|------|---------|--------|
| DMSACC | Declaration accepted | Store MRN, update status |
| DMSREJ | Declaration rejected | Parse error codes, notify user |
| DMSROG | Routed for examination | Update status |
| DMSCLE | Cleared | Mark as cleared |
| DMSINV | Validation errors | Parse field-level errors |
| DMSTAX | Tax calculated | Store tax details |
| DMSCTL | Controlled | Flag for customs control |
| DMSRES | Response | Store additional response data |

### Rate Limiting
- HMRC allows **3 requests/second** (upgradable to 8 via SDH Support)
- Proactive token-bucket limiter at `src/lib/rate-limiter.ts`
- Reactive retry on HTTP 429 with configured backoff

---

## 7. User Management

### Roles & Access
- **Authentication** via Clerk (email, Google, SSO)
- **2FA** enabled via Settings → Security
- **Workspaces** support multi-tenant access with role-based membership
- **Subscription tiers:** Starter, Professional, Enterprise (managed via Stripe)

### Adding Users
1. Users self-register at `/sign-in`
2. Clerk handles verification and MFA
3. Convex `users` table synced automatically via Clerk webhook
4. Admin can manage from `/dashboard/admin`

---

## 8. Deployment

### Local Development
```bash
npm install
npm run dev          # Start Next.js on port 3000
npx convex dev       # Start Convex dev server (separate terminal)
```

### Production Build
```bash
npm run build        # Build Next.js
npm start            # Start production server
npx convex deploy    # Deploy Convex schema + functions
```

### Hosting
- **Frontend:** Vercel (configured via `vercel.json` or Vercel dashboard)
- **Backend:** Convex Cloud (auto-deployed)
- **Production URL:** Update `HMRC_REDIRECT_URI` to match

---

## 9. Monitoring & Troubleshooting

### Health Check
```
GET https://your-domain.com/api/health
```
Returns: `{ status: "ok", environment: "sandbox|production", services: { convex, hmrc, clerk } }`

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| "HMRC OAuth Token not found" | User hasn't connected | Settings → Security → Connect HMRC |
| "Failed to refresh token" | Refresh token expired | User must Reconnect HMRC |
| HTTP 401 from HMRC | Token expired or invalid | Check token in Convex `hmrc_tokens` table |
| HTTP 429 from HMRC | Rate limit | Automatic retry handles this; reduce concurrent users if persistent |
| HTTP 400 from HMRC | Invalid XML | Check notification errors for field-level details |
| Declaration stuck "Processing" | Missed notification | Use pull notifications endpoint as fallback |

### Logs
- **Next.js:** Console output / Vercel Functions logs
- **Convex:** [Convex Dashboard](https://dashboard.convex.dev) → Logs tab
- **HMRC notifications:** Stored in `notifications` table with raw XML payloads

---

## 10. Backup & Recovery

| Component | Backup method |
|-----------|---------------|
| Database (Convex) | Convex provides automatic backups; export via dashboard |
| Documents (R2) | Cloudflare R2 has built-in redundancy; configure lifecycle rules |
| Environment config | Keep `.env.local` backed up securely (password manager / vault) |
| Code | Git repository |

---

## 11. Security Checklist

- [x] All secrets in `.env.local`, gitignored
- [x] HTTPS enforced (Vercel/Cloudflare)
- [x] OAuth 2.0 for HMRC (no API keys stored client-side)
- [x] XML input sanitisation (`xmlEscape()` on all user inputs)
- [x] Clerk handles auth, session management, CSRF protection
- [x] 2FA available for all users
- [x] Rate limiting on HMRC API calls
- [x] Webhook payloads stored for audit trail

---

## Quick Reference

| What | Where |
|------|-------|
| Convex Dashboard | [dashboard.convex.dev](https://dashboard.convex.dev) |
| Clerk Dashboard | [dashboard.clerk.com](https://dashboard.clerk.com) |
| Stripe Dashboard | [dashboard.stripe.com](https://dashboard.stripe.com) |
| HMRC Developer Hub | [developer.service.hmrc.gov.uk](https://developer.service.hmrc.gov.uk) |
| HMRC Support | [devhub-support](https://developer.service.hmrc.gov.uk/devhub-support) |
| HMRC API Status | [api-platform-status](https://api-platform-status.production.tax.service.gov.uk/) |
| Cloudflare R2 | [dash.cloudflare.com](https://dash.cloudflare.com) |
| Typesense | [cloud.typesense.org](https://cloud.typesense.org) |
