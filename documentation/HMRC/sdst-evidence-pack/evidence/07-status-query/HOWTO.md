# Status query — how to capture evidence

## In the app

1. Open declaration **FC-MPYAJ7RN** (MRN `26GB63M1I0RQFCVAR4`).
2. **Customs Status Timeline** → **Query HMRC status**.
3. On success, copy the green message (includes `HMRC status: …`).

## Save to this folder

- [ ] `summary.md` — date (UTC), MRN, HTTP 200, status field from response
- [ ] `response.json` — paste full JSON from browser Network tab → `status-query` response

## Log

Add a row in [`../../LOG.md`](../../LOG.md).

## CLI test (no browser)

```bash
node test-evidence/query-declaration-information-status.js
```

Writes `response.json` + `summary.md` in this folder.

## Trade Test Accept header

Use **`application/vnd.hmrc.1.0+xml`** (Information API v1.0 on Trade Test — not v2.0 JSON).  
App route `status-query` and `query-declaration-information-status.js` handle this automatically in sandbox.

## Scope requirement

OAuth must include **`write:customs-declarations-information`** (with `write:customs-declaration`).  
If HMRC returns `INVALID_SCOPE`, update `HMRC_SCOPES` in `.env.local` and **reconnect HMRC** in Settings.

## If it still fails

| Message | Meaning |
|---------|---------|
| `INVALID_SCOPE` | Reconnect HMRC after adding information scope to `HMRC_SCOPES` |
| `Unauthorized` (401) | Not signed in to Clerk, or Convex JWT template missing — refresh login |
| `Convex auth token missing` | Re-sign in; check Clerk Convex JWT template |
| `HMRC OAuth Token not found` | Reconnect HMRC in Settings |
| `HMRC status query failed` + details | HMRC body — often expired OAuth (retry after reconnect) or wrong MRN |
