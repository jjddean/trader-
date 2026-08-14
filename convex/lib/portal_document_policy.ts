export type ClientDocumentAttachmentConflict =
  | "document_client_mismatch"
  | "declaration_client_mismatch"
  | "tenant_mismatch"
  | "document_tenant_mismatch";

export type ClientDeclarationAttachmentConflict =
  | "declaration_client_mismatch"
  | "tenant_mismatch";

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOrgId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A client can claim only an unclaimed/same-client declaration in its tenant. */
export function clientDeclarationAttachmentConflict(input: {
  clientId: unknown;
  clientOrgId: unknown;
  declarationClientId: unknown;
  declarationOrgId: unknown;
}): ClientDeclarationAttachmentConflict | null {
  const clientId = normalizeId(input.clientId);
  const declarationClientId = normalizeId(input.declarationClientId);
  const clientOrgId = normalizeOrgId(input.clientOrgId);
  const declarationOrgId = normalizeOrgId(input.declarationOrgId);

  if (!clientId || (declarationClientId && declarationClientId !== clientId)) {
    return "declaration_client_mismatch";
  }
  if (clientOrgId !== declarationOrgId) return "tenant_mismatch";
  return null;
}

/** Validate the client and tenant invariants before attaching a portal document. */
export function clientDocumentAttachmentConflict(input: {
  clientId: unknown;
  clientOrgId: unknown;
  documentClientId: unknown;
  documentOrgId: unknown;
  declarationClientId: unknown;
  declarationOrgId: unknown;
}): ClientDocumentAttachmentConflict | null {
  const clientId = normalizeId(input.clientId);
  const documentClientId = normalizeId(input.documentClientId);
  const clientOrgId = normalizeOrgId(input.clientOrgId);
  const documentOrgId = normalizeOrgId(input.documentOrgId);

  if (!clientId || documentClientId !== clientId) return "document_client_mismatch";
  const declarationConflict = clientDeclarationAttachmentConflict(input);
  if (declarationConflict) return declarationConflict;
  if (documentOrgId && documentOrgId !== clientOrgId) {
    return "document_tenant_mismatch";
  }
  return null;
}

const PORTAL_SHARED_DOCUMENT_TYPES = new Set([
  "invoice",
  "packing_list",
  "certificate",
  "invoices",
  "packing lists",
  "certificates",
  "portal_upload",
  "correspondence",
]);

const PORTAL_UPLOAD_CATEGORIES = new Set([
  ...PORTAL_SHARED_DOCUMENT_TYPES,
  "n935",
  "n271",
  "n864",
  "n865",
  "n703",
  "c400",
  "u166",
  "u101",
  "u164",
  "9100",
  "zzz",
]);

function normalizeDocumentType(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Upload validation accepts portal categories and the CDS document codes. */
export function isAllowedPortalUploadCategory(value: unknown): boolean {
  const category = normalizeDocumentType(value);
  return !category || PORTAL_UPLOAD_CATEGORIES.has(category);
}

/** Broker documents need an explicitly shared type to appear in the client portal. */
export function isPortalSharedDocumentType(value: unknown): boolean {
  const fileType = normalizeDocumentType(value);
  return Boolean(fileType && PORTAL_SHARED_DOCUMENT_TYPES.has(fileType));
}

/** Explicit client ownership always wins over legacy type-based sharing. */
export function canPortalClientSeeDocument(input: {
  clientId: unknown;
  clientOrgId: unknown;
  portalClerkId: unknown;
  documentClientId: unknown;
  documentOrgId: unknown;
  documentUserId: unknown;
  fileType: unknown;
}): boolean {
  const clientId = normalizeId(input.clientId);
  const documentClientId = normalizeId(input.documentClientId);
  if (normalizeOrgId(input.clientOrgId) !== normalizeOrgId(input.documentOrgId)) return false;
  if (documentClientId) return Boolean(clientId && documentClientId === clientId);

  const portalClerkId = normalizeId(input.portalClerkId);
  const documentUserId = normalizeId(input.documentUserId);
  if (portalClerkId && documentUserId === portalClerkId) return true;

  return isPortalSharedDocumentType(input.fileType);
}
