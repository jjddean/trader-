# Portal: Document upload flow

Summary
- Clients can upload supporting documents from the portal even if a broker has not yet created/linked a declaration.
- Uploaded files that are not attached to a declaration are stored without a `declarationId` and with `status: "unlinked"`.

Behavior
- Client: The portal upload form is available regardless of whether a filing exists. The client may optionally select a filing; if none is selected the upload is treated as an orphaned document.
- Server: `generateMyUploadUrl` accepts an optional `declarationId`. `saveMyDocument` accepts an optional `declarationId`; when omitted the document is saved with `status: "unlinked"`.
- Ownership: Unlinked uploads are stored against the portal client, remain visible in the client's document library, and can be downloaded by that client without a declaration.

Security & validation
- If a `declarationId` is provided at upload-time, ownership is validated and the upload is only allowed when the declaration belongs to the same client.
- Orphaned uploads are scoped to the uploading client's client record, org, and user identity.

Portal UI
- "Upload without a filing" is the default target, even when declarations exist.
- Unlinked rows display "Waiting for broker" in the Filing column.

Manual test steps
1. Sign in as a portal client with no declarations.
2. Upload a file via the Documents page — it should upload successfully and appear in the list with `status: unlinked` (or visible note).
3. As a broker, locate the client's unlinked file and attach it to a declaration; verify the document's `declarationId` and `status` update accordingly.

Migration
- Existing deployments: no data migration required. New documents omit `declarationId` until linked.
