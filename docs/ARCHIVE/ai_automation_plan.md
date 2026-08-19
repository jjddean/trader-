# Phase 4: AI Automations Implementation Plan

**Status:** SUPERSEDED BY `docs/dev/AI-FIX-PLAN.md`. History, not instructions.

The objective of Phase 4 is to leverage the AI configurations defined in your `.env.local` to dramatically speed up the declaration process for your end-users. We will introduce two powerful AI features to the frontend builder.

## Proposed Architecture

### 1. AI Product Classification (Description to HS Code)
When a user is building a declaration in the "Items" tab, typing a plain-english product description will automatically suggest the correct 10-digit Harmonized System (HS) code.

*   **Provider Backend:** We will use your configured **Groq API** (`llama-3.3-70b-versatile`) because it offers near-instantaneous inference speed, which is critical for real-time autocomplete UI interactions.
*   **Next.js API Route:** `/api/ai/classify`
    *   Takes the `description` string.
    *   Prompts Groq to act as a UK Customs Expert.
    *   Returns a structured JSON array of the top 3 suggested HS codes with brief logic.
*   **Frontend UI:** We will attach an "AI Suggest" magic wand button next to the HS Code input on the "Add Item" dialog. Clicking it sends the description to the endpoint and populates a dropdown of suggestions.

### 2. AI Document Extraction (Invoice OCR)
Instead of manually typing out items, users can upload a Commercial Invoice PDF/Image, and the AI will extract the line items (Description, Value, Quantity, Origin) automatically into the "Items" table.

*   **Provider Backend:** Since `llama-3.3-70b` on Groq is a text-only model, we need a Vision model for OCR. Looking at your `.env.local`, there are several options:
    *   `OLLAMA_HOST` / `OLLAMA_URL` (if you have a vision model like `llava` running).
    *   Alternatively, we can use the `AGENT_URL` Cloudflare worker if it exposes OCR, or falling back to a lightweight PDF-text parsing library (like `pdf-parse`) and passing the text to Groq.
*   **Next.js API Route:** `/api/ai/extract`
    *   Takes the uploaded document file.
    *   Extracts raw text/layout.
    *   Prompts the AI to map the text into our `goods_items` schema format.
*   **Frontend UI:** A new "Extract from Invoice" upload dropzone directly on the "Items" tab.

## User Review Required
> [!CAUTION]
> **OCR Vision Model Configuration:** 
> For the Document Extraction feature, we need to read invoices (PDFs/Images). Are we utilizing a locally hosted **Ollama** vision model (e.g., LLaVA) via your `OLLAMA_URL`, or should I build a traditional text-extractor that feeds raw strings into the **Groq** text model?
> 
> Please let me know your preference for the OCR engine so I can scaffold the exact API route!

## Execution Steps
1. Build the Groq `/api/ai/classify` endpoint.
2. Update the "Add Item" Frontend Dialog with the AI Auto-suggest UI.
3. Build the `/api/ai/extract` Document OCR endpoint based on your feedback.
4. Add the "Extract from Invoice" dropzone to the Items table.
