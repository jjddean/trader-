# Deploy Cloudagent

Live URL: `https://cloudagent.jkdproductivity.workers.dev` (set in root `.env.local` as `AGENT_URL`).

## Auth error 10000

Wrangler needs credentials that can **edit Workers** on account `555e307a91082ae8c8e69b0a5ff3b8c3`.

Use the **same** token already in root `.env.local` as `CLOUDEFLARE_TOKEN`. Wrangler only reads `CLOUDFLARE_API_TOKEN` — the deploy script maps that automatically:

```powershell
cd cloudagent
npm run deploy
```

If you still get error 10000, the token needs **Workers Scripts Edit** (and Vectorize / Workers AI) on the same token in [API Tokens](https://dash.cloudflare.com/profile/api-tokens) — edit it, don’t create a new one.

### Option A — Browser login (bypasses API token)

```powershell
cd cloudagent
npx wrangler logout
npx wrangler login
npx wrangler deploy
```

### Option B — Manual token env (same value as CLOUDEFLARE_TOKEN)

1. [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → edit your existing token
2. Ensure **Workers Scripts Edit** (+ Vectorize, Workers AI if missing)
3. Deploy:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<same cfut_... token from .env.local>"
$env:CLOUDFLARE_ACCOUNT_ID = "555e307a91082ae8c8e69b0a5ff3b8c3"
npx wrangler deploy
```

Use `CLOUDFLARE_API_TOKEN` (Wrangler’s name). Same secret as `CLOUDEFLARE_TOKEN`.

## Verify after deploy

```powershell
Invoke-WebRequest https://cloudagent.jkdproductivity.workers.dev/ -UseBasicParsing
# POST /classify-document should return 400 (missing body) or 200 — not 404
```
