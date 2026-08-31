# FreightCode UI switch — handover

**Status:** ACTIVE
**Date:** 2026-08-24
**Branch:** `feature/design-system-preview` (6 commits ahead of `main`, not merged)

---

## What we are doing

Moving FreightCode's front end onto a single design system, copied from a
sister app of ours, `targets-app`.

Nothing about the backend changes. Convex, HMRC, auth are untouched.

---

## Why — the short version

FreightCode was generated from a Next.js starter that shipped with a design
system: a block of CSS variables defining colours, radius and shadows, plus a
set of shadcn UI components written against them.

That variable block was deleted on the second day of the project — commit
`a2e80db7`, 2026-03-08, as collateral in an unrelated change. Nobody noticed.

In Tailwind v4 a utility class only exists if its variable is declared. With the
block gone, `bg-card`, `bg-primary` and `border-border` generate no CSS at all,
so every shadcn component renders colourless. They looked broken, so they were
abandoned, and every screen since has been styled by hand.

Five months later:

| | FreightCode `main` |
|---|---|
| Files importing the `Card` component | **0** |
| Files hand-drawing a card instead | **114** (230 shells) |
| Raw `<button>` elements | **203** |
| Files importing the `Button` component | 7 |
| Raw `<table>` elements | 35 |
| Hand-written status pills | 92 |

That is why two screens built a month apart do not look like the same product.

There is a second, related fault. The root font size was set to 18px rather than
16px, which makes every named Tailwind size land on an odd number — `text-xs`
renders at 13.5px. So people stopped using the named sizes and typed exact
pixels instead: **1,206 hand-typed pixel sizes across 20 different values**. It
also half-breaks the text-size control in Settings, which can only move the
named sizes.

---

## Where the fix comes from

`targets-app` (local, `C:\Users\jason\targets-app`) is built on the same starter
but kept its variable block and stayed disciplined: 0 hand-drawn cards, 9 raw
buttons, 4 raw colour classes in the whole app.

So this is a restore, not a design exercise. The files were copied across, not
reinterpreted. Verified by diff, ignoring line endings:

- `design-tokens.ts` — byte-identical
- `page-shell.tsx` — 7 lines differ (import paths)
- 18 of 22 UI components — identical; the other 4 differ by 2–4 lines where a
  dependency FreightCode does not have had to be removed

---

## What is built, and where

All on `feature/design-system-preview`. **None of it is on `main`.**

| What | File |
|---|---|
| Colour, radius, shadow and dark tokens | `src/app/globals.css` (78 → 261 lines) |
| Shared class strings (`ds.card`, `ds.sectionLabel`, …) | `src/components/dashboard/design-tokens.ts` |
| Layout components — `PageContainer`, `PageHeading`, `PageSection`, `MetricStrip`, `StatTile`, `AlertBanner`, `PageLoading`, `PageEmpty` | `src/components/dashboard/page-shell.tsx` |
| 22 UI components, replacing FreightCode's drifted copies | `src/components/ui/` |
| Working proof — the declaration workspace rebuilt on it | `src/app/design-preview/` |
| Longer plan | `docs/design-system/PLAN.md` |

### The proof

`/design-preview` is a throwaway route behind sign-in. It rebuilds all five
declaration workspace pages — core schema, goods items, submission, HMRC status,
secure upload — on the new system, at field parity with the real ones.

It is **read-only**. No mutation is wired anywhere; Save updates local state and
returns. It cannot write to a declaration.

---

## What is not done

- **No real page uses it yet.** On the branch, `clients` still carries 111
  hand-typed colour classes, exactly as on `main`. The only consumers of the new
  layout components are the six preview pages.
- **The 16px root fix is preview-only.** Applying it globally resizes 1,610
  named text classes at once, so it is deliberately a separate step.
- **The client portal is untouched** — 9 pages, its own shell, zero shared
  components.

---

## The one real risk

FreightCode's copies of `select`, `dialog`, `dropdown-menu` and `sidebar` had
been hand-patched with literal colours (`bg-white`, `border-gray-200`,
`ring-gray-300/60`) to survive the missing variables. Those files have been
replaced wholesale with targets' versions.

Only `sidebar` was checked by eye. If any of the other patches were deliberate
fixes, they are gone — recoverable from git, but currently unverified.

So before this merges, someone needs to run the branch and open the screens that
use those four components and confirm dropdowns open, dialogs appear, and the
sidebar behaves.

---

## How to run it

```bash
git checkout feature/design-system-preview
npm run dev
```

Then:

- `/design-preview` — the new system, pick any declaration
- `/dashboard/declarations` — the current UI, unchanged, for comparison

---

## Where help is most useful

1. **Verify the four replaced components** against the screens that use them.
   This is the gate on merging.
2. **Convert real pages onto `page-shell`**, one screen at a time. Heaviest
   first: Clients (111 colour classes), Reports (108), Records (88),
   Trade Compliance (74), Settings (71).
3. **Remove the 18px root** and sweep the 1,206 pixel sizes onto the named
   scale. Largely mechanical.
4. **Decide on the client portal** — convert it or leave it legacy. It does not
   block anything.

Steps 2–4 are independent and can run in parallel by screen.
