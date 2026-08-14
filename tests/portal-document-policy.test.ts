import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canPortalClientSeeDocument,
  clientDeclarationAttachmentConflict,
  clientDocumentAttachmentConflict,
  isAllowedPortalUploadCategory,
  isPortalSharedDocumentType,
} from "../convex/lib/portal_document_policy";

describe("portal document attachment policy", () => {
  const validAttachment = {
    clientId: "client-a",
    clientOrgId: "org-a",
    documentClientId: "client-a",
    documentOrgId: "org-a",
    declarationClientId: undefined,
    declarationOrgId: "org-a",
  };

  it("allows an unclaimed declaration in the same tenant", () => {
    assert.equal(clientDocumentAttachmentConflict(validAttachment), null);
  });

  it("rejects a declaration already assigned to another client", () => {
    assert.equal(
      clientDocumentAttachmentConflict({
        ...validAttachment,
        declarationClientId: "client-b",
      }),
      "declaration_client_mismatch",
    );
  });

  it("rejects cross-tenant client claims", () => {
    assert.equal(
      clientDocumentAttachmentConflict({
        ...validAttachment,
        declarationOrgId: "org-b",
      }),
      "tenant_mismatch",
    );
  });

  it("rejects a document whose stored tenant conflicts with its client", () => {
    assert.equal(
      clientDocumentAttachmentConflict({
        ...validAttachment,
        documentOrgId: "org-b",
      }),
      "document_tenant_mismatch",
    );
  });

  it("keeps personal client and declaration records in the same scope", () => {
    assert.equal(
      clientDocumentAttachmentConflict({
        ...validAttachment,
        clientOrgId: undefined,
        documentOrgId: undefined,
        declarationOrgId: undefined,
      }),
      null,
    );
  });

  it("filters attachable declarations by client and tenant", () => {
    assert.equal(
      clientDeclarationAttachmentConflict({
        clientId: "client-a",
        clientOrgId: "org-a",
        declarationClientId: undefined,
        declarationOrgId: "org-a",
      }),
      null,
    );
    assert.equal(
      clientDeclarationAttachmentConflict({
        clientId: "client-a",
        clientOrgId: "org-a",
        declarationClientId: "client-b",
        declarationOrgId: "org-a",
      }),
      "declaration_client_mismatch",
    );
  });
});

describe("portal document type policy", () => {
  it("accepts CDS codes for portal uploads", () => {
    for (const code of ["N935", "C400", "ZZZ", "  n271  "]) {
      assert.equal(isAllowedPortalUploadCategory(code), true, code);
    }
  });

  it("does not make CDS-coded broker documents portal-visible", () => {
    for (const code of ["N935", "C400", "ZZZ", "n271"]) {
      assert.equal(isPortalSharedDocumentType(code), false, code);
    }
  });

  it("preserves explicit shared portal document types", () => {
    for (const type of ["invoice", "packing_list", "certificate", "correspondence"]) {
      assert.equal(isAllowedPortalUploadCategory(type), true, type);
      assert.equal(isPortalSharedDocumentType(type), true, type);
    }
  });

  it("rejects unsupported upload categories", () => {
    assert.equal(isAllowedPortalUploadCategory("internal_broker_note"), false);
    assert.equal(isPortalSharedDocumentType("internal_broker_note"), false);
  });
});

describe("portal document visibility policy", () => {
  const base = {
    clientId: "client-b",
    clientOrgId: "org-b",
    portalClerkId: "portal-b",
    documentClientId: undefined,
    documentOrgId: "org-b",
    documentUserId: "broker",
    fileType: "invoice",
  };

  it("denies another client's document even when its type is normally shared", () => {
    assert.equal(
      canPortalClientSeeDocument({ ...base, documentClientId: "client-a" }),
      false,
    );
  });

  it("allows the current client's document regardless of document type", () => {
    assert.equal(
      canPortalClientSeeDocument({
        ...base,
        documentClientId: "client-b",
        fileType: "internal_broker_note",
      }),
      true,
    );
  });

  it("denies documents outside the portal client's tenant", () => {
    assert.equal(canPortalClientSeeDocument({ ...base, documentOrgId: "org-a" }), false);
  });

  it("preserves legacy own-upload and explicitly shared broker documents", () => {
    assert.equal(
      canPortalClientSeeDocument({ ...base, documentUserId: "portal-b", fileType: "ZZZ" }),
      true,
    );
    assert.equal(canPortalClientSeeDocument(base), true);
    assert.equal(canPortalClientSeeDocument({ ...base, fileType: "N935" }), false);
  });
});
