---
name: testing-tradedna-preview
description: Test TradeDNA PR previews and Core Schema UI flows end-to-end. Use when verifying browser-visible changes in the Next.js/Convex app.
---

# TradeDNA Preview E2E Testing

## Devin Secrets Needed

- `TRADER_VERCEL_BYPASS_SECRET`: Vercel Deployment Protection bypass secret for PR previews.
- `TRADER_TEST_EMAIL`: Clerk test-account email for the app.
- `TRADER_TEST_PASSWORD`: Clerk test-account password for the app.
- Optional local fallback secrets/env vars when preview access is unavailable:
  - `NEXT_PUBLIC_CONVEX_URL`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`

Do not store or write actual secret values in the repo.

## Preview Access Checklist

1. Open the PR's Vercel preview URL from the GitHub PR comment/checks.
2. If Vercel deployment protection appears, use the bypass secret with the preview URL before recording.
3. Confirm the app itself loads, then sign in with the Clerk test account if prompted.
4. Only start screen recording after Vercel and Clerk setup are complete.
5. If preview access returns HTTP 401 or redirects to Vercel login, do not claim browser E2E passed. Mark UI assertions as untested and ask for working preview access.

## Useful Commands

Check preview access without exposing secrets in logs:

```bash
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L --max-redirs 2 'https://<preview-host>/dashboard/declarations'
```

Check whether local fallback env vars are present:

```bash
env | cut -d= -f1 | grep -E '^(NEXT_PUBLIC_CONVEX_URL|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY|CLERK_SECRET_KEY|CONVEX_DEPLOYMENT)$' | sort
```

## Core Schema Declaration Reference Flow

Use this flow when validating declaration-reference UI/default changes:

1. Navigate to `/dashboard/declarations`.
2. Open a disposable declaration row, or create one and navigate back from `/items` to the base `/dashboard/declarations/[id]` Core Schema page.
3. Verify actual values for Presentation Office, Goods Location, Invoice Currency, Incoterms, Incoterm Location, and Destination Country are blank when no saved values exist.
4. Save explicit non-default test values, reload, and verify exact hydration.
5. Inspect the responsive grid at desktop and medium widths.

Use values intentionally different from old examples, such as `GBDVR001`, `GBDOVRPORT1`, `EUR`, `CIF`, `DUBLIN`, and a non-GB destination country such as `IE`.
