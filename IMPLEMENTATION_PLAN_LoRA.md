# Implementation Plan - HS Code LoRA Integration (GIRs 1-6)

Integrate a specialized HS Code classification agent using Low-Rank Adaptation (LoRA) and General Interpretative Rules (GIRs 1-6).

## User Review Required

> [!IMPORTANT]
> **Architectural Decision**: I am integrating the GIR logic as a dedicated endpoint in the `cloudagent` Worker while preserving the existing Durable Object orchestration.

> [!NOTE]
> The original LoRA training guide has been archived at [cloudagent/docs/archive/TRAINING_GUIDE.md](file:///c:/Users/jason/trader-app/cloudagent/docs/archive/TRAINING_GUIDE.md). Treat it as historical guidance only; UK commodity-code training labels must come from official UK Trade Tariff data, not padded 6-digit HS prefixes.

## Proposed Changes

---

### [Component] CloudAgent Worker

#### [NEW] [girAgent.ts](file:///c:/Users/jason/trader-app/cloudagent/src/prompts/girAgent.ts)
Implement the system and user prompts for GIR classification.

#### [MODIFY] [index.ts](file:///c:/Users/jason/trader-app/cloudagent/src/index.ts)
- Add target `/classify-gir` route with LoRA inference logic.
- Reference the LoRA ID `hs-classifier-v1`.

#### [NEW] [generate-training-data.mjs](file:///c:/Users/jason/trader-app/scripts/generate-training-data.mjs)
Script to format Convex data into the `[INST]` Mistral format.

---

## Open Questions

1. **Base Model**: I've optimized the docs for **Mistral-7B-v0.2**, which is Cloudflare's recommended LoRA-compatible model. Is this your preferred choice?

## Verification Plan

- `wrangler dev` to test the new route with a mock LoRA ID.
- Run the data generator script and verify CSV format for AutoTrain.
