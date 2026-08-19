# Phase 3: HMRC API Integration Layer Implementation Plan

**Status:** SUPERSEDED — Phase 3 scaffold; the integration shipped. Current behaviour is defined by `docs/hmrc/ACTIVE/tdr/AGENT-SPEC.md`. History, not instructions.

Now that the local database and frontend UI validation are complete, this phase focuses entirely on the backend orchestration layer that connects the Freightcode Next.js server directly to HMRC's Customs Declaration Service (CDS) APIs.

## User Review Required
> [!CAUTION]
> **HMRC Application Requirements:** In order to test these APIs effectively, you must have an active Application registered on the [HMRC Developer Hub](https://developer.service.hmrc.gov.uk/).
> We will need the following Environment Variables supplied to the Next.js backend (`.env.local`):
> *   `HMRC_CLIENT_ID`
> *   `HMRC_CLIENT_SECRET`
> *   `HMRC_SERVER_TOKEN` (for App-restricted endpoints)
> *   `HMRC_ENVIRONMENT` (set to `sandbox` initially)
> Please ensure you have generated these on the Developer Hub before we test the actual endpoints.

## Proposed Architecture

We will implement three core internal API routes in Next.js (`/api/hmrc/...`) that map directly to the 3 essential HMRC APIs you provided.

### 1. OAuth & Government Gateway Wrapper
Before any declaration is sent, we must handle User-restricted OAuth 2.0. 
*   **Path:** `/api/hmrc/auth`
*   **Function:** Handles the redirect to the Government Gateway login page, and processes the callback to secure the Bearer token.
*   **Storage:** We will store these temporary tokens against the user's `workspace` in Convex (with a secure refresh mechanism).

### 2. The unified Submission Endpoint (`Customs Declarations API`)
*   **Path:** `/api/hmrc/submit` (Next.js App router)
*   **Trigger:** Clicked via the frontend "Send to CDS" button.
*   **Function:**
    *   Retrieves the `declaration` and nested `goods_items` from Convex.
    *   Transforms the data into the mandatory WCO (World Customs Organization) JSON payload format.
    *   Injects the OAuth Bearer token.
    *   Sends a `POST` request to `https://test-api.service.hmrc.gov.uk/customs/declarations/v1/declaration` (sandbox).
    *   Parses the `conversation-id` from the synchronous `202 Accepted` response.
    *   Updates the Convex status to `Processing`.

### 3. Asynchronous Webhook Receiver (`CDS Notifications API`)
*   **Path:** `/api/hmrc/webhooks/notify`
*   **Function:** Exposes a public, secure endpoint for HMRC to push XML payload events.
*   **Handling:** 
    *   Validates the incoming HMRC signature/authorization.
    *   Matches the incoming `conversation-id` to our Convex database.
    *   Parses the event to extract the official **MRN**.
    *   Updates the profile status to `Accepted`, `Cleared`, or handles error codes if `Rejected`.

### 4. Document Upload Initiation Controller (`Secure Document Upload API`)
*   **Path:** `/api/hmrc/documents/initiate`
*   **Function:** Because HMRC uses a complex 2-step S3 upload process, this route will ping HMRC first to gather the temporary, secure AWS S3 bucket URL and authorization tokens needed for the specific document. It returns this directly to the frontend, allowing the user's browser to securely `POST` the PDF straight to HMRC without proxying via our server.

## Next Steps for Execution
If this architecture aligns with your understanding of the HMRC Developer Hub specs, I will proceed to scaffold the Next.js `/app/api/hmrc` directory and construct the first component: the OAuth wrapper logic.
