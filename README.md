# TradeDNA / freightcode

Minimal local workflow:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Stop the app with `Ctrl+C`.

## Root directory

Run commands from the repository root: the folder containing `package.json`, `next.config.ts`, `src/`, and `convex/`.

For Vercel or other deployment tools, set the project root directory to the repository root (`.`) or leave it blank if the tool defaults to repo root.

## Local environment

Put local secrets and service URLs in `.env.local`.

Do not commit `.env.local`.

## Useful commands

```bash
npm run dev      # Start Next.js locally on port 3000
npm run build    # Build locally
npm run start    # Start a production build locally
npm run lint     # Run ESLint
```

No Docker, extra ports, tunnels, worktrees, or deployment steps are required for the basic local workflow.
