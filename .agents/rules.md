# FreightCode — universal safety rules

Copy of `.cursorrules` for agent runtimes that read `.agents/`. **Meaning is identical.** Keep the two files in lockstep.

These are not a product specification. Operating contract: `CLAUDE.md`. HMRC/CDS behaviour: `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`.

1. **Task scope.** Only access and modify files the task authorises. Do not edit unrelated files while you are there. Extra issues: report; do not fix unless authorised. Preserve unrelated working-tree changes.

2. **Authority.** Follow `CLAUDE.md` §1. Do not treat current code, tests, stale Markdown, env, or deploy config as a product decision. Do not rewrite intended behaviour to match implementation. Spec vs code: report the conflict; do not guess.

3. **Secrets.** No credentials in source. `.env.local` and Convex secrets only. Do not edit or expose sensitive keys in `.env.local`.

4. **Auth.** Do not weaken authentication or authorisation to make a task pass. Do not add unauthenticated public Convex data access.

5. **Git and deploy.** Do not commit, push, force-push, hard-reset, or deploy unless the user explicitly asks. Do not submit, amend, or cancel HMRC/CDS filings unless the user explicitly authorises it.

6. **Convex size.** Never store more than 1,000 rows in Convex. Use versioned R2 pointers (`v2026-03.json` style). Do not Convex-filter large tables.

7. **Search.** High-volume commodity search is the UK Trade Tariff API (`src/lib/trade-tariff-client.ts`) plus Convex reference tables. Do not add Typesense. A `typesense` dependency in `package.json` is not permission to use it.

8. **Tariff / VAT / duty.** Hardcoded TypeScript only. AI explains calculated values; it must not invent or override them. Sanitize inputs before AI prompts. Document system prompts for AI features.

9. **Compliance tests.** Changes to tax, duty, or other compliance logic must update the matching tests. Verification command names: `AGENTS.md` and `CLAUDE.md` §7.

10. **Unverified AI output.** Treat AI-suggested code as unverified.

11. **Architecture.** If a request contradicts the intended architecture, flag it and stop. Do not invent a new architecture to resolve it.
