# Connect HMRC — OAuth troubleshooting (sandbox)

**Resolved:** 2026-06-08 (local). Use this if Connect fails again with grantscope stalls, `client_id is invalid`, or silent callback failures.

**HMRC sources:** [User-restricted endpoints](https://developer.service.hmrc.gov.uk/api-documentation/docs/authorisation/user-restricted-endpoints), [Testing in the sandbox](https://developer.service.hmrc.gov.uk/api-documentation/docs/testing)

---

## Symptoms we hit

| Symptom | Often mistaken for |
|---------|-------------------|
| `client_id is invalid` on authorize | Wrong client secret / rotated credentials |
| Stuck on `test-www…/oauth/grantscope` after Test User sign-in — no redirect | Expired Romwan creds only |
| Connect button hidden; red HMRC dot still present | App “disconnected” |
| Hours with no visible error | Broken OAuth |
| Callback never runs | HMRC down |

**Ruled out:** Sandbox `HMRC_CLIENT_ID` / secret (verified via `client_credentials` to `test-api…/oauth/token`).

---

## Root cause (2026-06)

OAuth is a **chain**. Any one mismatch breaks the journey after sign-in (or at authorize):

| # | Must match |
|---|------------|
| 1 | **Redirect URI** — same string in Developer Hub, `HMRC_REDIRECT_URI` (Next.js `.env.local` / Vercel), and the browser origin you use |
| 2 | **Authorize host** — browser sign-in on `test-www.tax.service.gov.uk`, **not** `test-api.service.hmrc.gov.uk` |
| 3 | **Token host** — code exchange on `test-api.service.hmrc.gov.uk/oauth/token` |
| 4 | **PKCE** — if `code_challenge` sent on authorize, `code_verifier` required on token exchange |
| 5 | **App origin** — start Connect from the same host as redirect URI (e.g. `http://localhost:3000`, not 3005) so Clerk session + PKCE cookie survive the round trip |

**Not the cause for sandbox grantscope:** missing **production** credentials. Test User sign-in on `test-www` is sandbox-only. Production OAuth uses `www` / `api` and real HMRC accounts — see [`environment-matrix.md`](environment-matrix.md).

**Not the cause for browser Connect:** Convex `HMRC_REDIRECT_URI` (Convex does not run the OAuth routes; Next.js does). Fix Convex for consistency only.

---

## Correct sandbox configuration

### Developer Hub (sandbox app)

Redirect URIs (exact):

- `http://localhost:3000/auth/hmrc/callback`
- `https://www.freightcode.co.uk/auth/hmrc/callback`

### Environment (Next.js / Vercel)

```env
HMRC_ENVIRONMENT=sandbox
HMRC_REDIRECT_URI=http://localhost:3000/auth/hmrc/callback   # local only
# Production deploy: https://www.freightcode.co.uk/auth/hmrc/callback
HMRC_CLIENT_ID=<sandbox tab>
HMRC_CLIENT_SECRET=<sandbox tab>
HMRC_SCOPES=write:customs-declaration write:customs-declarations-information
```

Local dev must run on **port 3000** when using the localhost redirect URI.

### Code (implemented)

| Step | Host / behaviour | Code |
|------|------------------|------|
| Authorize | `https://test-www.tax.service.gov.uk/oauth/authorize` | `hmrcOAuthAuthorizeBaseUrl()` in `src/lib/hmrc-oauth.ts` |
| Token | `https://test-api.service.hmrc.gov.uk/oauth/token` | `hmrcOAuthBaseUrl()` in `src/lib/hmrc-oauth.ts` |
| PKCE | S256 challenge + verifier | `src/lib/hmrc-pkce.ts`, `src/app/api/hmrc/auth/route.ts`, `src/app/auth/hmrc/callback/route.ts` |
| PKCE backup | Convex `hmrc_oauth_pkce` | `convex/hmrc.ts` — requires `npx convex dev` / deploy |
| Errors | Dashboard red/green banner | `src/components/hmrc-connect-banner.tsx` |

---

## Recovery checklist

1. **Developer Hub** — redirect URIs match env exactly (scheme, host, port, path).
2. **`.env.local` / Vercel** — `HMRC_REDIRECT_URI` matches where you click Connect.
3. **Dev server** — `npm run dev` on `http://localhost:3000` (not 3005).
4. **Convex** — `npx convex dev` running if using PKCE Convex backup.
5. **Clerk** — signed in on dashboard before Connect (session must survive redirect).
6. **Connect once** — single click; avoid double Connect (invalidates PKCE state).
7. **Test User** — Romwan or fresh user from `node scripts/create-test-user.js` (not live GOV.UK login on sandbox).
8. **Read failure** — dashboard `?error=` banner or dev log `[HMRC CALLBACK]`.

### Error codes → action

| `?error=` | Action |
|-----------|--------|
| `pkce_missing` | Restart dev server; Connect once; ensure same host 3000 |
| `login_required` | Sign into Clerk first; callback redirects to sign-in with return URL |
| `token_exchange_failed` | Check banner `msg` (HMRC body); verify redirect URI identical on authorize + token |
| `invalid_request` | Usually authorize URL / client_id host mismatch |
| `state_mismatch` | CSRF guard — Connect once without extra tabs |

---

## Production Connect (future)

Separate from sandbox. When SDST production app is live:

| | Sandbox (now) | Production |
|--|-----------------|------------|
| Authorize | `test-www.tax.service.gov.uk` | `www.tax.service.gov.uk` |
| Token | `test-api.service.hmrc.gov.uk` | `api.service.hmrc.gov.uk` |
| Client ID | Sandbox tab | Production tab (`HMRC_PRODUCTION_CLIENT_ID`) |
| Sign-in | Test User | Real HMRC account |
| Redirect | localhost / freightcode.co.uk | `https://www.freightcode.co.uk/auth/hmrc/callback` |

Deploy OAuth code (PKCE + authorize host split) to Vercel before testing production Connect.

---

## Related

- [`environment-matrix.md`](environment-matrix.md) — TT / TDR / Live hosts and Accept headers
- [`hmrc-operations-runbook.md`](hmrc-operations-runbook.md) — §1 OAuth
- [`evidence/LOG.md`](evidence/LOG.md) — ops timeline
- [`../../ARCHIVE/trade-test/test-user.md`](../../ARCHIVE/trade-test/test-user.md) — Romwan sandbox credentials
