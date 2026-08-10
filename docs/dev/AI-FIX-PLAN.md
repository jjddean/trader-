# AI fix plan

Saved from product review (2026-07-28). Interim LLMs: **OpenAI in production**, **Groq locally** (`src/lib/llm-chat.ts`). Trained customs models later swap behind the same APIs.

Duty / preference / tariff maths stay **deterministic** — AI explains, does not invent rates.

---

## Goals

1. Fix wrong / dead AI wiring in the product.
2. Make the assistant useful with real user data + tariff engines.
3. Keep human review gates; no model names in customer UI.
4. Leave hooks for trained-model providers later.

---

## Workstreams

### 1. Export document upload — use dedicated extract (P0)

**Wrong today:** Trade Compliance document audit uploads call `/api/ai/extract` (import invoice line-items) only to get OCR text, then `/api/export-controls/audit` runs export facts again.

**Fix:**
- Point Document audit file upload at `POST /api/export-controls/extract` (Textract → export facts → optional `persistExtraction`).
- Then run audit on returned `rawText` / extraction (avoid duplicate export-facts call if extract already persisted).
- Keep `/api/ai/extract` for **declaration Items** invoice import only.

**Done when:** Export upload no longer hits `/api/ai/extract`; products land on the assessment for Classify.

**Files:**
- `src/components/trade-compliance/document-audit-panel.tsx`
- `src/app/api/export-controls/extract/route.ts`
- `src/app/api/export-controls/audit/route.ts` (optional: skip re-extract when facts already present)

---

### 2. Assistant — richer Convex context + tariff tools (P0)

**Wrong today:** Chat persists in Convex and gets thin context (MRN/status/EORI, doc names, notifications, validation fails). It does **not** load goods items / financials and does **not** call Trade Tariff or preference engines — so it can invent duty/HS answers.

**Fix:**
1. Expand `assistantQueries.getAssistantContext`:
   - Goods items (HS, origin, value, CPC, packages)
   - Document codes / blocking gaps
   - Declaration financials (estimate vs DMSTAX if present)
   - Recent submission / validation detail
2. In `/api/ai/chat`, add **server-side tool path** (or explicit pre-fetch) for:
   - Trade Tariff / `duty_rate_parser` / `/api/tariff/preference` equivalents
   - Optional CDS error-code lookup from `cds_error_codes`
3. System prompt: never invent duty/preference; only cite returned engine results.
4. UI: show linked declaration (or “no declaration open”) in the side sheet.

**Done when:** On a declaration URL, assistant can answer from real items/docs/financials and return preference/duty from engines, not guesswork.

**Files:**
- `convex/assistantQueries.ts`
- `src/app/api/ai/chat/route.ts`
- `src/components/assistant-side-sheet.tsx`
- Reuse: `src/lib/preference-engine.ts`, `convex/lib/duty_rate_parser.ts`, `src/lib/trade-tariff-client.ts`

---

### 3. HS suggest API — wire or delete (P1)

**Wrong today:** `POST /api/ai/classify` (HS from text → top 3 codes) has **no UI caller**.

**Decision (pick one):**
- **A (preferred if product wants AI HS assist):** Wire “Suggest HS” on declaration **Items** (and optionally HS lookup). User picks → still verify via Trade Tariff / apply manually.
- **B:** Delete `/api/ai/classify` to remove dead surface.

**Done when:** Either a visible Suggest HS control works, or the route is gone.

**Files:**
- `src/app/api/ai/classify/route.ts`
- `src/app/dashboard/declarations/[id]/items/page.tsx` (if A)

---

### 4. Provider / config hygiene (P1 — mostly done)

**Done:**
- Shared `src/lib/llm-chat.ts`: prod → OpenAI (`gpt-4o-mini`), non-prod → Groq; override via `AI_PROVIDER`.
- Chat, extract, classify, export facts extract, export classify use that helper.

**Still check:**
- Vercel production has `OPENAI_API_KEY` set.
- `AGENT_URL` set for smart upload + GIR audit (cloud agent — not the chat LLM).
- Soft-fail messaging when agent missing (Documents GIR / smart upload).
- Audit route extraction gate uses OpenAI **or** Groq key (already updated).

---

### 5. Leave alone (not bugs)

| Feature | Status |
|---|---|
| Export Classify (`/api/export-controls/classify`) | Live — keep; human approve |
| Invoice extract on Items | Live — correct path for import |
| Smart upload (Documents) | Live — needs `AGENT_URL` |
| Sanctions screen | Deterministic — not generative AI |
| Preference / duty / tariff engines | Deterministic — do not replace with LLM |
| Dry-run / DE 2/3 doc validation | Rules — not AI |

---

## Order of work

| # | Task | Priority |
|---|---|---|
| 1 | Wire Trade Compliance upload → `/api/export-controls/extract` | P0 |
| 2 | Assistant context expansion (Convex) | P0 |
| 3 | Assistant tariff/preference tool calls | P0 |
| 4 | Assistant UI: linked declaration indicator | P1 |
| 5 | HS `/api/ai/classify` — wire Items **or** delete | P1 |
| 6 | Prod env checklist (`OPENAI_API_KEY`, `AGENT_URL`) | P1 |
| 7 | Trained-model provider flag (later) | P2 |

---

## Out of scope (later)

- Trained export-control / HS models (swap behind `llm-chat` / classify adapters).
- Solutions marketing copy for AI features.
- Removing Groq from local entirely.

---

## Acceptance (overall)

- [ ] Export upload uses export extract only; Classify sees persisted products.
- [ ] Assistant answers from real declaration data; duty/preference from engines.
- [ ] No orphan `/api/ai/classify` (wired or deleted).
- [ ] Prod uses OpenAI; local still works on Groq.
- [ ] Humans still approve classification / apply HS / review extracts.
