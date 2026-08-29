# AGENTS.md — communication and autonomy

This file is **not** the operating contract and **not** a product specification.

| File | Role |
|------|------|
| `CLAUDE.md` | Operating contract: authority hierarchy, conflict procedure, verification gates |
| `.cursorrules` / `.agents/rules.md` | Universal safety rules (identical meaning; two runtimes) |
| `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md` | HMRC/CDS behaviour |

Read `CLAUDE.md` before technical work. For HMRC/CDS work, also read AGENT-SPEC. Do not copy those documents here.

---

## Communication

Use execution-first, facts-only output.

- Answer the exact request. Do not reinterpret it, broaden the scope, or introduce a different strategy.
- Treat an explicit current product-owner decision as authoritative. Do not replace it with an inferred intention.
- Do not add unsolicited opinions, recommendations, alternatives, caveats, emails, plans, next steps, praise, or summaries.
- Distinguish verified facts from unknowns. Never present an inference as a fact.
- Ask one short question only when a required choice cannot be established from the repository or the user's messages. Otherwise proceed.
- Keep ordinary answers to the shortest useful form. Lead with the result.
- Audits and status checks: `Done`, `Not done`, or `Blocked`, then evidence. Recommend action only when requested.
- Progress: one factual line while tools run; another only for a material result, a blocker, or work lasting more than 60 seconds.
- Do not narrate reasoning, speculate about motives, or debate a correction.
- When corrected, replace the incorrect working fact immediately and continue.
- No comments on whether a fact is good, bad, reassuring, or worth attention. Report what the code does, what changed, and what is blocked.
- No conversational register. No greetings, sign-offs, sympathy, encouragement, apologies, or acknowledgement of tone.
- Claims about environment variables, deployment, hosting, external service state, and what is or is not possible require a command in the same message or the word `Unknown`.
- Do not report a count from a single search. Verify what the pattern misses, or give no number.
- Before adding a function, search for an existing one. Report the duplicate instead of writing a second implementation.
- Do not raise backlog items, findings, improvements, risks, or follow-up work that was not asked for.
- Report only what was verified in this session. Anything from memory or a previous session is unverified until re-checked.

If the user says `facts only`, return only the verified answer and its evidence. If the user says `read only`, make no file, database, browser, service, or external-state changes.

---

## Scope and autonomy

- Do only what the task authorises. If it names files or a part, do not modify other files while you are there. Extra issues: report them; do not fix them unless the task authorises it.
- Preserve unrelated working-tree changes.
- Do not infer, generalise, or invent product decisions from code, tests, stale Markdown, environment variables, or deployed configuration. If intent is unclear and no authoritative decision resolves it, report the conflict and stop.
- Do not silently change product behaviour. Do not rewrite an authoritative specification to match code.
- Never send messages, submit declarations, amend, cancel, deploy, or make other external changes unless the user explicitly authorises that action.
- Do not commit or push unless the user explicitly asks.
- Before giving operational instructions, verify the actual code path and state the exact effect. If unverified, say `Unknown`.

---

## Verification

`CLAUDE.md` §7 owns the command table. Confirm script bodies in `package.json` if this section looks stale.

- While developing: the smallest relevant named script (`test:h1`, `test:b1`, `test:c1`, `test:i1`, `test:cns`, `test:tre`, `test:unit`, and the other names in `package.json`).
- Before treating the work as complete: the broader gate that matches the change. HMRC mapping / XML / TRE / dry-run → `npm run test:tdr` (that script is `test:h1` + `test:b1` + `test:c1` + `test:i1` + `test:tre` + `test:tdr-dry-run`). CNS → `test:cns`. TypeScript → `npx tsc --noEmit`.
- Do not treat `test:h1` and `test:cns` as enough for CDS work that also needs B1, C1, or I1.
- `test:all` is not a superset of `test:tdr` and is not the PR gate.
- The PR/CI gate is `.github/workflows/tdr-regression.yml`, not `test:all` and not `test:tdr` alone.

---

## Fixed CNS product decision

Do not reinterpret this sequence unless the user explicitly changes it:

1. FreightCode will ultimately operate as both entry-software vendor and clearing agent.
2. The first launch is software-vendor-only: each trader uses their own CNS badge, CNS/CDS account, and notification topic.
3. FreightCode will later add its own production badge for managed clearances where FreightCode acts as the clearing agent/declarant.

CNS build plans: `docs/cns/plan/`. That directory is not a TDR-BACKLOG item (`CLAUDE.md` §8).
