# Implementation Plan: Cloudagent AI Classification & Compliance Audit

**Status:** DONE — both endpoints built. The worker is live and consumed by `src/app/api/ai/gir-audit/route.ts`.

This document outlines the plan to integrate two AI-powered endpoints into the `cloudagent` worker: `/classify` and `/api/compliance-audit`.

## 1. Safety & Security
- **Authentication**: All endpoints require a Bearer Token (`CLASSIFY_SECRET`).
- **Validation**: Incoming requests are validated for required fields (`description`, `textractOutput`, `declaredHsCode`).
- **Sanitization**: AI responses are sanitized to remove markdown formatting (```json) before parsing.

## 2. Components

### A. AI Prompts (`src/gir-prompt.ts`)
- **GIR_SYSTEM_PROMPT**: System instructions for UK customs classification using General Interpretative Rules 1-6.
- **buildGIRPrompt**: Helper to format the user prompt with Textract output and declared code.

### B. Request Handlers (`src/classify.ts`)
- **handleClassify**: Direct product classification from description.
- **handleComplianceAudit**: Audit of declared HS codes against invoice data.

### C. Worker Integration (`src/index.ts`)
- Update `fetch` handler to route POST requests to the new handlers.

### D. Configuration (`wrangler.toml`)
- Add `CLASSIFY_SECRET` variable.

## 3. LoRA Integration Plan
Once a fine-tuned LoRA adapter is trained:
1. Upload using `npx wrangler ai finetune create`.
2. Update the `env.AI.run` call in `classify.ts` to include the `lora` parameter and use a compatible base model.

## 4. Verification
- Test via `curl`:
  ```bash
  curl -X POST https://cloudagent.workers.dev/api/compliance-audit -H "Authorization: Bearer SECRET" -d '{"textractOutput": "...", "declaredHsCode": "..."}'
  ```
