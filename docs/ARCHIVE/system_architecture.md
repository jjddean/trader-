**Status:** ARCHIVED — history only. March 2026 draft. Not current architecture.

Current stack: `CLAUDE.md` §4.

---
title: System Architecture Document
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Architectural Overview
freightcode is built on a modern, serverless, full-stack JavaScript architecture prioritizing speed, AI-extensibility, and rigid security protocols necessary for handling government and financial data.

# 2. Technology Stack
- **Frontend / Framework:** Next.js (React), App Router, Tailwind CSS, shadcn/ui.
- **Backend / Database:** Convex (Serverless reactive database, real-time sync, CRON jobs, HTTP webhooks).
- **Authentication:** Clerk (B2B SaaS configuration, OAuth provisioning).
- **AI & Extraction:** External calls to OpenAI / Anthropic APIs via secure Convex Actions or Next.js Route Handlers.
- **Payments (Phase 3):** TrueLayer or Stripe Connect (Open Banking / PISP APIs).

# 3. System Components & Flow

## 3.1 The Frontend (Client Layer)
- Deployed on Vercel.
- Uses Convex React context hooks (`useQuery`, `useMutation`) for instant, optimistic UI updates without manual loading states or REST fetching.
- Interacts securely with Clerk for session management.

## 3.2 The Database (Convex Layer)
- **Standard Tables:** `users`, `workspaces`, `lanes` (declarations), `goods_items`.
- **Reactive Functions:** Mutations (e.g., `createDeclaration`) run transactionally on the V8 engine, ensuring ACID compliance.
- **Actions:** Heavy external fetching (e.g., calling the HMRC API) is offloaded to Convex Actions, which do not lock database transactions.

## 3.3 The Integration Layer (Next.js `/api/...`)
Because HMRC and Open Banking APIs require strict IP whitelisting, exact HTTP signature headers, and OAuth token management, we securely proxy these calls through our Next.js backend rather than raw client-side calls.

- **`/api/hmrc/auth`**: OAuth 2.0 gateway flow.
- **`/api/hmrc/submit`**: Transforms Convex data into WCO JSON payloads; holds the Bearer token.
- **`/api/hmrc/webhooks/notify`**: A secure, public-facing endpoint allowing HMRC to post XML status updates. Matches the `conversation-id` to Convex and updates the clearance status to `Cleared` or `Rejected`.

## 3.4 The AI Extraction Layer
When a user uploads a Commercial Invoice over the UI:
1. The PDF is securely sent to `/api/ai/extract`.
2. The server parses the document and prompts a highly-structured Large Language Model call enforcing strict JSON schema responses.
3. The structured JSON (Items, HS Codes, Values) is returned to the client and immediately inserted into the Convex database as draft `goods_items`.

# 4. Security & Data Sovereignty
- **Data at Rest:** All Convex data is encrypted at rest.
- **Token Management:** Developer/Sandbox tokens are kept in `.env.local` and never exposed to the client. User-specific production HMRC OAuth tokens will be securely assigned to workspace records, fully encrypted, and strictly scoped to read/write customs data only.
- **Payment Security:** The system will utilize an FCA-authorized Technical Service Provider structure. We will never custody or touch importer funds, effectively bypassing the requirement for standalone FCA EMI licensing initially.
