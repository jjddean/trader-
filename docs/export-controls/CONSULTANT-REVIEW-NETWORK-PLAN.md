# Consultant Review Network Plan

## Objective

Turn FreightCode's existing secure consultant-review flow into a reusable, commercially operated expert-review service. FreightCode remains the workflow and integration owner, approved consultants provide specialist decisions, and connected trade applications receive structured status updates and completed outcomes.

The product is not initially a marketplace. It begins as a controlled pilot with one consultant and FreightCode as the first connected application.

## Operating model

```text
Source application -> FreightCode review service -> approved consultant -> FreightCode review service -> source application
```

FreightCode provides:

- The review-case API and common case format.
- Secure case and evidence workspace.
- Consultant assignment and authenticated access.
- Information-request and response workflow.
- Review outcome, application and licence records.
- Status webhooks and audit history.
- Commercial relationship with connected providers.

The consultant provides:

- Specialist review and documented advice.
- Classification and licence determination where in scope.
- Requests for missing evidence or end-user information.
- Application support and application/licence references where commissioned.
- A clear completed, blocked or escalated outcome.

## Phase 1 — FreightCode pilot

Use the existing FreightCode workflow as the starting point:

1. A FreightCode user prepares an export-control assessment and evidence pack.
2. The user requests consultant review.
3. FreightCode creates a time-limited review dispatch.
4. The consultant receives the case in their own application's inbox rather than relying on email.
5. The consultant opens the FreightCode-hosted secure workspace.
6. The consultant reviews evidence, requests information, records advice and completes or blocks the case.
7. FreightCode writes the result to the assessment, licence record and audit history.
8. The related result remains available for the CDS declaration and export-clearance record.

Email remains a fallback notification during the pilot.

### Consultant application requirements

The consultant's application needs only:

- An authenticated consultant account and inbox.
- One HTTPS webhook endpoint for incoming review notifications.
- FreightCode webhook-signature verification.
- A small record containing FreightCode review ID, reference, status, priority, due date and expiry.
- An **Open secure review** action.
- Optional receipt of status updates for opened, waiting, completed, blocked and expired cases.

The webhook must not contain sensitive evidence. It carries metadata and a one-time handoff code. The consultant's server exchanges that code with FreightCode, and FreightCode binds the case to the verified consultant identity.

### How to build the consultant link in their application

The consultant application does not recreate FreightCode's assessment screens. It adds a small integration that receives a case and sends the consultant into the secure FreightCode review workspace.

1. **Register the consultant application**
   - Create a consultant-partner record in FreightCode.
   - Store the consultant application's webhook URL.
   - Issue a partner ID and webhook-signing secret for server-to-server use.
   - Register the permitted consultant users or organisation.

2. **Add an inbound webhook endpoint to the consultant application**
   - Example: `POST /api/integrations/freightcode/reviews`.
   - Read the raw request body before parsing it.
   - Verify the FreightCode signature, timestamp and event ID.
   - Reject invalid, expired or replayed requests.
   - Return `2xx` only after the notification has been stored.

3. **Store a local review notification**
   - Minimum fields: FreightCode review ID, external reference, status, subject/company label, priority, due date, expiry, received time and handoff state.
   - Do not copy invoices, evidence or sensitive assessment data into the consultant application during the pilot.
   - Enforce a unique constraint on the FreightCode event ID or review ID so webhook retries do not create duplicates.

4. **Display the case in the consultant's authenticated inbox**
   - Add a **FreightCode reviews** list or queue.
   - Show the reference, status, priority, due date and received time.
   - Only authorised consultant users can see or open the notification.
   - Add an **Open secure review** button; do not place a reusable review URL in the database or browser markup.

5. **Request a one-time handoff when the consultant opens the case**
   - The consultant application's server sends the stored review ID to FreightCode using its partner credentials.
   - FreightCode verifies the partner, assigned consultant, review status and expiry.
   - FreightCode returns a single-use, short-lived handoff URL or code.
   - The consultant application redirects the browser to that URL.

6. **Bind the consultant identity in FreightCode**
   - The handoff endpoint requires the consultant to be authenticated with an approved account.
   - FreightCode consumes the code once, binds the review to that consultant identity and starts the secure review session.
   - Reuse, expiry, wrong-partner access or an unapproved user must fail closed.

7. **Complete all review work in FreightCode**
   - The consultant views evidence, requests missing information, records findings and adds application or licence references in the FreightCode-hosted workspace.
   - The consultant application remains an inbox and launch point; FreightCode remains the system of record for the review and audit history.

8. **Synchronise status back to the consultant application**
   - FreightCode sends signed events such as `review.opened`, `review.waiting_for_information`, `review.completed`, `review.blocked`, `review.expired` and `review.revoked`.
   - The consultant application updates its local row idempotently and links back to the case when further action is allowed.

#### Phase 1 webhook notification

The initial notification contains only routing metadata:

```json
{
  "eventId": "evt_...",
  "eventType": "review.assigned",
  "occurredAt": "2026-08-04T12:00:00Z",
  "review": {
    "id": "rev_...",
    "reference": "FC-EC-...",
    "status": "new",
    "priority": "standard",
    "dueAt": null,
    "expiresAt": "2026-08-11T12:00:00Z"
  }
}
```

It must not include the evidence pack, declarations, personal data beyond the agreed display label, or a reusable bearer link.

#### Phase 1 handoff exchange

The consultant application's backend calls a FreightCode endpoint equivalent to:

```text
POST /v1/consultant-reviews/{reviewId}/handoff
Authorization: Bearer <partner credential>
```

FreightCode returns a short-lived, single-use URL. The browser is redirected there, the code is consumed, and the consultant continues inside the existing FreightCode secure-review page. This is the specific link between the two applications.
### FreightCode changes required for the pilot

- Add consultant-partner records and per-partner credentials.
- Add an approved webhook URL and signing secret per partner.
- Add webhook delivery, retry and failure history.
- Replace reusable bearer-link delivery with a one-time handoff exchange for integrated partners.
- Bind accepted reviews to an authenticated consultant account.
- Add review statuses: `new`, `opened`, `waiting_for_information`, `ready_to_complete`, `completed`, `blocked`, `expired` and `revoked`.
- Keep the existing token link and email as a controlled fallback.
- Record every delivery, access, request and decision in the audit trail.

## Phase 2 — Reusable provider API

After the pilot is proven, allow another customs or trade application to request the same service.

### Provider application requirements

The provider application needs:

- FreightCode API credentials or an OAuth client.
- One request to create a review case.
- One HTTPS webhook endpoint for status and result updates.
- Webhook-signature verification.
- Storage of the FreightCode review ID against its own case ID.
- A small **Request specialist review** action and status/result panel.

The provider does not build consultant assignment, review forms, secure evidence access or the consultant workspace.

### Minimum create-case contract

The source application submits:

- External case ID and callback reference.
- Customer and organisation details required for the engagement.
- Product, shipment, destination and intended-use facts.
- Existing classification and screening results, if available.
- Questions and requested review scope.
- Supporting documents through controlled upload IDs or expiring download URLs.
- Priority and requested completion date.

FreightCode returns:

- FreightCode review ID.
- Accepted status.
- Current status URL or API resource.
- Expected next action.

### Result contract

FreightCode returns:

- Review status and timestamps.
- Consultant findings and documented opinion.
- Classification and licence determination where in scope.
- Missing-information requests.
- Recommended action.
- Application and licence references where applicable.
- Completed review document and audit events.

## Phase 3 — Hosted entry options

Reduce integration effort for providers that cannot build an API connection immediately:

- A hosted **Create review** dashboard.
- Secure client evidence and information links.
- A co-branded embeddable request form.
- Manual case creation for consultants.
- CSV or structured file import only where appropriate.

These options use the same review service and data model. They do not become separate workflows.

## Phase 4 — Expert network

Expand beyond the pilot consultant only after volume and operational evidence justify it:

- Add approved consultants by jurisdiction and speciality.
- Route cases by scope, jurisdiction, availability and conflict checks.
- Add acceptance deadlines, service levels and reassignment.
- Support provider-selected consultants and FreightCode-supplied consultants.
- Maintain consultant qualification, insurance and approval records.
- Add quality review, complaints and outcome monitoring.

The two commercial options become:

1. **FreightCode Expert Network** — FreightCode supplies and manages the consultant.
2. **Bring Your Own Consultant** — the customer uses FreightCode's secure workflow with an approved specialist.

## Commercial model

Start with a simple per-review arrangement:

- FreightCode charges the source provider or end customer.
- The consultant receives an agreed fixed fee or revenue share.
- Additional fees apply for application management, urgent work or expanded scope.

Later options may include:

- Provider API subscription plus usage.
- Consultant workspace subscription.
- Per-review transaction fees.
- White-labelled workflow licence.
- Managed expert-network pricing.

FreightCode owns the review service, API, workflow, integration standard and software. The consultant owns their professional advice. Partner terms must prohibit credential sharing, sublicensing and resale of the FreightCode workflow outside the agreed service.

## Security and governance requirements

Before external provider launch:

- Use server-side credentials only; never expose API secrets in browsers.
- Sign webhooks and defend against replay with timestamp and event ID validation.
- Use one-time, short-lived handoff codes.
- Bind consultant access to verified identity and assigned case.
- Apply strict tenant, provider and consultant case isolation.
- Encrypt evidence in transit and at rest.
- Record consent and the lawful basis for sharing client information.
- Define controller/processor responsibilities and retention periods.
- Provide revocation, expiry and deletion controls.
- Add conflict-of-interest confirmation before consultant acceptance.
- Define professional-liability, service-level and escalation terms.
- Keep an immutable event history for delivery, access, changes and decisions.

## Pilot acceptance criteria

The pilot is complete only when:

- A FreightCode assessment reaches the consultant's authenticated inbox without an email attachment.
- The handoff cannot be reused or accepted by another consultant account.
- Evidence is accessible only after successful handoff and identity verification.
- The consultant can request missing information and complete or block the review.
- Application and licence references return to the original assessment.
- The source user can see current status without contacting the consultant separately.
- All significant events appear in the FreightCode audit history.
- Failed webhook delivery retries safely and exposes an operational alert.
- Revocation and expiry work end to end.
- A complete pilot case can remain connected to the related CDS declaration and clearance record.

## Expansion decision gates

Do not begin the next phase until the preceding gate is met:

1. **Pilot gate:** at least five real reviews completed without email attachments or manual case reconstruction.
2. **API gate:** the case schema and status model remain stable across the pilot cases.
3. **Second-provider gate:** one external software provider completes an end-to-end sandbox integration.
4. **Network gate:** review volume exceeds the pilot consultant's safe capacity or requires additional specialisms.
5. **White-label gate:** repeated commercial demand justifies branding and configuration work.

## Explicitly deferred

- Open consultant marketplace.
- Automated consultant bidding.
- Native review interfaces inside every provider application.
- Multi-country regulatory coverage beyond demonstrated demand.
- Automated final legal or licensing decisions.
- Direct submission to government licensing systems unless an authorised, supported interface exists.
