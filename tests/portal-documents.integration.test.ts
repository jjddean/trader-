/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

function createHarness() {
  return convexTest({ schema, modules });
}

type Harness = ReturnType<typeof createHarness>;

const brokerIdentity = {
  subject: "broker-a",
  tokenIdentifier: "test|broker-a",
  org_id: "org-a",
};

function portalIdentity(subject: string) {
  return {
    subject,
    tokenIdentifier: `test|${subject}`,
  };
}

async function insertClient(
  t: Harness,
  input: {
    name: string;
    portalClerkId: string;
    orgId?: string;
    ownerId?: string;
  },
): Promise<Id<"clients">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("clients", {
      userId: input.ownerId ?? "broker-a",
      ...(input.orgId ? { orgId: input.orgId } : {}),
      name: input.name,
      portalEmail: `${input.portalClerkId}@example.test`,
      portalClerkId: input.portalClerkId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function insertDeclaration(
  t: Harness,
  input: {
    clientId?: Id<"clients">;
    orgId?: string;
    userId?: string;
    mrn?: string;
  },
): Promise<Id<"declarations">> {
  return await t.run(async (ctx) =>
    await ctx.db.insert("declarations", {
      userId: input.userId ?? "broker-a",
      ...(input.orgId ? { orgId: input.orgId } : {}),
      ...(input.clientId ? { clientId: input.clientId } : {}),
      ...(input.mrn ? { mrn: input.mrn } : {}),
      declarationType: "IM",
      status: "Draft",
      created: Date.now(),
      lastUpdated: Date.now(),
    }),
  );
}

async function insertRequirement(
  t: Harness,
  declarationId: Id<"declarations">,
  status = "missing",
): Promise<Id<"document_requirements">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("document_requirements", {
      declarationId,
      userId: "broker-a",
      code: "N935",
      name: "Commercial invoice",
      requirementLevel: "blocking",
      status,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function storeFile(t: Harness, contents: string): Promise<Id<"_storage">> {
  return await t.run(async (ctx) =>
    await ctx.storage.store(new Blob([contents], { type: "application/pdf" })),
  );
}

async function insertDocument(
  t: Harness,
  input: {
    fileId: Id<"_storage">;
    fileName: string;
    fileType: string;
    clientId?: Id<"clients">;
    declarationId?: Id<"declarations">;
    orgId?: string;
    userId?: string;
    status?: string;
  },
): Promise<Id<"documents">> {
  return await t.run(async (ctx) =>
    await ctx.db.insert("documents", {
      fileId: input.fileId,
      fileName: input.fileName,
      fileType: input.fileType,
      userId: input.userId ?? "broker-a",
      ...(input.orgId ? { orgId: input.orgId } : {}),
      ...(input.clientId ? { clientId: input.clientId } : {}),
      ...(input.declarationId ? { declarationId: input.declarationId } : {}),
      status: input.status ?? "unlinked",
      auditStatus: "pending",
      uploadDate: new Date().toISOString(),
    }),
  );
}

describe("portal requirement uploads", () => {
  it("atomically creates the targeted document and closes the outstanding request", async () => {
    const t = createHarness();
    const clientId = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const declarationId = await insertDeclaration(t, {
      clientId,
      orgId: "org-a",
      mrn: "MRN-A",
    });
    const requirementId = await insertRequirement(t, declarationId);
    const storageId = await storeFile(t, "invoice-one");

    const result = await t.withIdentity(portalIdentity("portal-a")).mutation(
      api.client_portal.saveMyDocument,
      {
        storageId,
        declarationId,
        requirementId,
        fileName: "commercial-invoice.pdf",
        fileType: "ZZZ",
        category: "N935",
      },
    );

    const state = await t.run(async (ctx) => ({
      document: await ctx.db.get(result.documentId),
      requirement: await ctx.db.get(requirementId),
      auditLogs: await ctx.db.query("auditLogs").collect(),
    }));

    expect(state.document).toMatchObject({
      clientId,
      declarationId,
      fileType: "N935",
      mrn: "MRN-A",
      status: "pending_review",
    });
    expect(state.requirement).toMatchObject({
      status: "uploaded",
      linkedDocumentId: result.documentId,
    });
    expect(state.auditLogs).toHaveLength(1);
    expect(state.auditLogs[0]?.action).toBe("portal_document_uploaded");
  });

  it("rejects a replay after the request closes without creating a second document", async () => {
    const t = createHarness();
    const clientId = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const declarationId = await insertDeclaration(t, { clientId, orgId: "org-a" });
    const requirementId = await insertRequirement(t, declarationId);
    const portal = t.withIdentity(portalIdentity("portal-a"));

    await portal.mutation(api.client_portal.saveMyDocument, {
      storageId: await storeFile(t, "first"),
      declarationId,
      requirementId,
      fileName: "first.pdf",
      fileType: "N935",
      category: "N935",
    });

    await expect(
      portal.mutation(api.client_portal.saveMyDocument, {
        storageId: await storeFile(t, "replay"),
        declarationId,
        requirementId,
        fileName: "replay.pdf",
        fileType: "N935",
        category: "N935",
      }),
    ).rejects.toThrow("Document request is no longer outstanding");

    const state = await t.run(async (ctx) => ({
      documents: await ctx.db.query("documents").collect(),
      requirement: await ctx.db.get(requirementId),
    }));
    expect(state.documents).toHaveLength(1);
    expect(state.requirement?.status).toBe("uploaded");
  });

  it("rejects a requirement/declaration mismatch with no partial document write", async () => {
    const t = createHarness();
    const clientId = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const requestedDeclarationId = await insertDeclaration(t, { clientId, orgId: "org-a" });
    const wrongDeclarationId = await insertDeclaration(t, { clientId, orgId: "org-a" });
    const requirementId = await insertRequirement(t, requestedDeclarationId);

    await expect(
      t.withIdentity(portalIdentity("portal-a")).mutation(api.client_portal.saveMyDocument, {
        storageId: await storeFile(t, "wrong-target"),
        declarationId: wrongDeclarationId,
        requirementId,
        fileName: "wrong-target.pdf",
        fileType: "N935",
        category: "N935",
      }),
    ).rejects.toThrow("Document request belongs to a different filing");

    const state = await t.run(async (ctx) => ({
      documents: await ctx.db.query("documents").collect(),
      requirement: await ctx.db.get(requirementId),
      auditLogs: await ctx.db.query("auditLogs").collect(),
    }));
    expect(state.documents).toHaveLength(0);
    expect(state.auditLogs).toHaveLength(0);
    expect(state.requirement).toMatchObject({ status: "missing" });
  });
});

describe("portal requirement deep links", () => {
  it("loads an exact older request beyond the aggregate cap and rejects invalid scopes", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const clientB = await insertClient(t, {
      name: "Client B",
      portalClerkId: "portal-b",
      orgId: "org-a",
    });
    const targetDeclarationId = await insertDeclaration(t, {
      clientId: clientA,
      orgId: "org-a",
      mrn: "OLDER-TARGET-MRN",
    });
    const targetRequirementId = await insertRequirement(t, targetDeclarationId);

    // Ensure the target predates more declarations than the aggregate query reads.
    await new Promise((resolve) => setTimeout(resolve, 2));
    for (let index = 0; index < 51; index += 1) {
      const declarationId = await insertDeclaration(t, {
        clientId: clientA,
        orgId: "org-a",
        mrn: `NEWER-${index}`,
      });
      await insertRequirement(t, declarationId);
    }

    const portalA = t.withIdentity(portalIdentity("portal-a"));
    const aggregate = await portalA.query(api.client_portal.listMyDocumentRequirements, {});
    expect(aggregate).toHaveLength(50);
    expect(aggregate.some((row) => row._id === targetRequirementId)).toBe(false);

    const foreignDeclarationId = await insertDeclaration(t, {
      clientId: clientB,
      orgId: "org-a",
      mrn: "FOREIGN-MRN",
    });
    const foreignRequirementId = await insertRequirement(t, foreignDeclarationId);
    const crossTenantDeclarationId = await insertDeclaration(t, {
      clientId: clientA,
      orgId: "org-b",
      mrn: "CROSS-TENANT-MRN",
    });
    const crossTenantRequirementId = await insertRequirement(t, crossTenantDeclarationId);

    await expect(
      portalA.query(api.client_portal.getMyDocumentRequirement, {
        requirementId: String(targetRequirementId),
      }),
    ).resolves.toMatchObject({
      _id: targetRequirementId,
      declarationId: targetDeclarationId,
      mrn: "OLDER-TARGET-MRN",
      code: "N935",
    });
    await expect(
      portalA.query(api.client_portal.getMyDocumentRequirement, {
        requirementId: "not-a-convex-id",
      }),
    ).resolves.toBeNull();
    await expect(
      portalA.query(api.client_portal.getMyDocumentRequirement, {
        requirementId: String(foreignRequirementId),
      }),
    ).resolves.toBeNull();
    await expect(
      portalA.query(api.client_portal.getMyDocumentRequirement, {
        requirementId: String(crossTenantRequirementId),
      }),
    ).resolves.toBeNull();
  });
});

describe("client/declaration association invariants", () => {
  it("rejects a creator-accessible cross-org client atomically", async () => {
    const t = createHarness();
    const crossOrgClientId = await insertClient(t, {
      name: "Creator-owned Client B",
      portalClerkId: "portal-b",
      orgId: "org-b",
      ownerId: "broker-a",
    });
    const declarationId = await insertDeclaration(t, {
      orgId: "org-a",
      userId: "broker-a",
    });
    const before = await t.run(async (ctx) => await ctx.db.get(declarationId));

    await expect(
      t.withIdentity(brokerIdentity).mutation(api.clients.setClient, {
        declarationId,
        clientId: String(crossOrgClientId),
      }),
    ).rejects.toThrow("The client and filing must belong to the same organisation");

    const state = await t.run(async (ctx) => ({
      declaration: await ctx.db.get(declarationId),
      auditLogs: await ctx.db.query("auditLogs").collect(),
    }));
    expect(state.declaration?.clientId).toBeUndefined();
    expect(state.declaration?.lastUpdated).toBe(before?.lastUpdated);
    expect(state.auditLogs).toHaveLength(0);
  });
});

describe("broker attachment invariants", () => {
  it("rejects an upload from one client being attached to another client's filing", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const clientB = await insertClient(t, {
      name: "Client B",
      portalClerkId: "portal-b",
      orgId: "org-a",
    });
    const targetDeclarationId = await insertDeclaration(t, {
      clientId: clientB,
      orgId: "org-a",
    });
    const documentId = await insertDocument(t, {
      fileId: await storeFile(t, "client-a"),
      fileName: "client-a-invoice.pdf",
      fileType: "N935",
      clientId: clientA,
      orgId: "org-a",
    });

    await expect(
      t.withIdentity(brokerIdentity).mutation(api.documents.linkDocumentToDeclaration, {
        documentId,
        declarationId: targetDeclarationId,
      }),
    ).rejects.toThrow("The filing belongs to a different client");

    const state = await t.run(async (ctx) => ({
      document: await ctx.db.get(documentId),
      declaration: await ctx.db.get(targetDeclarationId),
    }));
    expect(state.document?.declarationId).toBeUndefined();
    expect(state.declaration?.clientId).toBe(clientB);
  });

  it("rejects a cross-organisation target before changing either record", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const targetDeclarationId = await insertDeclaration(t, {
      orgId: "org-b",
      userId: "broker-b",
    });
    const documentId = await insertDocument(t, {
      fileId: await storeFile(t, "cross-org"),
      fileName: "cross-org.pdf",
      fileType: "N935",
      clientId: clientA,
      orgId: "org-a",
    });

    await expect(
      t.withIdentity(brokerIdentity).mutation(api.documents.linkDocumentToDeclaration, {
        documentId,
        declarationId: targetDeclarationId,
      }),
    ).rejects.toThrow("Unauthorized");

    const state = await t.run(async (ctx) => ({
      document: await ctx.db.get(documentId),
      declaration: await ctx.db.get(targetDeclarationId),
    }));
    expect(state.document?.declarationId).toBeUndefined();
    expect(state.declaration?.clientId).toBeUndefined();
  });

  it("attaches a same-client upload, claims an unassigned filing, and closes its requirement", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const declarationId = await insertDeclaration(t, { orgId: "org-a", mrn: "MRN-A" });
    const requirementId = await insertRequirement(t, declarationId);
    const documentId = await insertDocument(t, {
      fileId: await storeFile(t, "same-client"),
      fileName: "same-client.pdf",
      fileType: "N935",
      clientId: clientA,
      orgId: "org-a",
    });

    await t.withIdentity(brokerIdentity).mutation(api.documents.linkDocumentToDeclaration, {
      documentId,
      declarationId,
    });

    const state = await t.run(async (ctx) => ({
      document: await ctx.db.get(documentId),
      declaration: await ctx.db.get(declarationId),
      requirement: await ctx.db.get(requirementId),
    }));
    expect(state.declaration?.clientId).toBe(clientA);
    expect(state.document).toMatchObject({
      declarationId,
      mrn: "MRN-A",
      status: "pending_review",
      linkedBy: "broker-a",
    });
    expect(state.requirement).toMatchObject({
      status: "uploaded",
      linkedDocumentId: documentId,
    });
  });

  it("rejects moving an attached client upload to another filing", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const originalDeclarationId = await insertDeclaration(t, {
      clientId: clientA,
      orgId: "org-a",
      mrn: "MRN-ORIGINAL",
    });
    const targetDeclarationId = await insertDeclaration(t, {
      clientId: clientA,
      orgId: "org-a",
      mrn: "MRN-TARGET",
    });
    const documentId = await insertDocument(t, {
      fileId: await storeFile(t, "attached-client-upload"),
      fileName: "attached-client-upload.pdf",
      fileType: "N935",
      clientId: clientA,
      declarationId: originalDeclarationId,
      orgId: "org-a",
      status: "pending_review",
    });

    await expect(
      t.withIdentity(brokerIdentity).mutation(api.documents.linkDocumentToDeclaration, {
        documentId,
        declarationId: targetDeclarationId,
      }),
    ).rejects.toThrow("Client upload is already attached to a filing");

    const document = await t.run(async (ctx) => await ctx.db.get(documentId));
    expect(document).toMatchObject({
      declarationId: originalDeclarationId,
      status: "pending_review",
    });
    expect(document?.mrn).toBeUndefined();
  });
});

describe("client-scoped unlinked attachment", () => {
  it("attaches a matching client document and claims an unassigned filing", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const declarationId = await insertDeclaration(t, {
      orgId: "org-a",
      mrn: "CLIENT-ATTACH-MRN",
    });
    const requirementId = await insertRequirement(t, declarationId);
    const documentId = await insertDocument(t, {
      fileId: await storeFile(t, "client-attach"),
      fileName: "client-attach.pdf",
      fileType: "N935",
      clientId: clientA,
      orgId: "org-a",
    });

    await t.withIdentity(brokerIdentity).mutation(api.clients.attachUnlinkedDocument, {
      clientId: clientA,
      documentId,
      declarationId,
    });

    const state = await t.run(async (ctx) => ({
      document: await ctx.db.get(documentId),
      declaration: await ctx.db.get(declarationId),
      requirement: await ctx.db.get(requirementId),
    }));
    expect(state.declaration?.clientId).toBe(clientA);
    expect(state.document).toMatchObject({
      declarationId,
      mrn: "CLIENT-ATTACH-MRN",
      status: "pending_review",
      linkedBy: "broker-a",
    });
    expect(state.requirement).toMatchObject({
      status: "uploaded",
      linkedDocumentId: documentId,
    });
  });

  it("rejects a cross-client filing without partially changing document or requirement", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const clientB = await insertClient(t, {
      name: "Client B",
      portalClerkId: "portal-b",
      orgId: "org-a",
    });
    const declarationId = await insertDeclaration(t, {
      clientId: clientB,
      orgId: "org-a",
      mrn: "CLIENT-B-MRN",
    });
    const requirementId = await insertRequirement(t, declarationId);
    const documentId = await insertDocument(t, {
      fileId: await storeFile(t, "cross-client"),
      fileName: "cross-client.pdf",
      fileType: "N935",
      clientId: clientA,
      orgId: "org-a",
    });

    await expect(
      t.withIdentity(brokerIdentity).mutation(api.clients.attachUnlinkedDocument, {
        clientId: clientA,
        documentId,
        declarationId,
      }),
    ).rejects.toThrow("The filing does not belong to this client");

    const state = await t.run(async (ctx) => ({
      document: await ctx.db.get(documentId),
      declaration: await ctx.db.get(declarationId),
      requirement: await ctx.db.get(requirementId),
    }));
    expect(state.document).toMatchObject({ status: "unlinked" });
    expect(state.document?.declarationId).toBeUndefined();
    expect(state.document?.linkedBy).toBeUndefined();
    expect(state.declaration?.clientId).toBe(clientB);
    expect(state.requirement).toMatchObject({ status: "missing" });
    expect(state.requirement?.linkedDocumentId).toBeUndefined();
  });

  it("rejects creator-accessible cross-org records without partial writes", async () => {
    const t = createHarness();
    const crossOrgClient = await insertClient(t, {
      name: "Creator-owned Client B",
      portalClerkId: "portal-b",
      orgId: "org-b",
      ownerId: "broker-a",
    });
    const declarationId = await insertDeclaration(t, {
      orgId: "org-a",
      userId: "broker-a",
      mrn: "ORG-A-MRN",
    });
    const requirementId = await insertRequirement(t, declarationId);
    const documentId = await insertDocument(t, {
      fileId: await storeFile(t, "cross-org-client"),
      fileName: "cross-org-client.pdf",
      fileType: "N935",
      clientId: crossOrgClient,
      orgId: "org-b",
    });

    await expect(
      t.withIdentity(brokerIdentity).mutation(api.clients.attachUnlinkedDocument, {
        clientId: crossOrgClient,
        documentId,
        declarationId,
      }),
    ).rejects.toThrow("The document, client, and filing must belong to the same organisation");

    const state = await t.run(async (ctx) => ({
      document: await ctx.db.get(documentId),
      declaration: await ctx.db.get(declarationId),
      requirement: await ctx.db.get(requirementId),
    }));
    expect(state.document).toMatchObject({ status: "unlinked", orgId: "org-b" });
    expect(state.document?.declarationId).toBeUndefined();
    expect(state.document?.linkedAt).toBeUndefined();
    expect(state.declaration?.clientId).toBeUndefined();
    expect(state.requirement).toMatchObject({ status: "missing" });
    expect(state.requirement?.linkedDocumentId).toBeUndefined();
  });
});

describe("portal list and download visibility", () => {
  it("hides a deliberately mislinked explicit-client invoice from the wrong portal", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const clientB = await insertClient(t, {
      name: "Client B",
      portalClerkId: "portal-b",
      orgId: "org-a",
    });
    const declarationB = await insertDeclaration(t, {
      clientId: clientB,
      orgId: "org-a",
      mrn: "MRN-B",
    });

    const ownDocumentId = await insertDocument(t, {
      fileId: await storeFile(t, "own"),
      fileName: "client-b.pdf",
      fileType: "N935",
      clientId: clientB,
      declarationId: declarationB,
      orgId: "org-a",
      userId: "portal-b",
    });
    const sharedDocumentId = await insertDocument(t, {
      fileId: await storeFile(t, "shared"),
      fileName: "shared-invoice.pdf",
      fileType: "invoice",
      declarationId: declarationB,
      orgId: "org-a",
    });
    const mislinkedDocumentId = await insertDocument(t, {
      fileId: await storeFile(t, "mislinked"),
      fileName: "client-a-mislinked-invoice.pdf",
      fileType: "invoice",
      clientId: clientA,
      declarationId: declarationB,
      orgId: "org-a",
      userId: "portal-a",
    });
    const brokerCodeOnlyDocumentId = await insertDocument(t, {
      fileId: await storeFile(t, "broker-code"),
      fileName: "broker-code-only.pdf",
      fileType: "N935",
      declarationId: declarationB,
      orgId: "org-a",
    });

    const portalB = t.withIdentity(portalIdentity("portal-b"));
    const visible = await portalB.query(api.client_portal.listMyDocuments, {});
    const visibleIds = new Set(visible.map((document) => String(document._id)));

    expect(visibleIds).toEqual(new Set([String(ownDocumentId), String(sharedDocumentId)]));
    await expect(
      portalB.mutation(api.client_portal.getMyDocumentDownloadUrl, {
        documentId: ownDocumentId,
      }),
    ).resolves.toEqual(expect.any(String));
    await expect(
      portalB.mutation(api.client_portal.getMyDocumentDownloadUrl, {
        documentId: sharedDocumentId,
      }),
    ).resolves.toEqual(expect.any(String));
    await expect(
      portalB.mutation(api.client_portal.getMyDocumentDownloadUrl, {
        documentId: mislinkedDocumentId,
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      portalB.mutation(api.client_portal.getMyDocumentDownloadUrl, {
        documentId: brokerCodeOnlyDocumentId,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("hides a corrupt cross-tenant declaration and strips its link metadata from client documents", async () => {
    const t = createHarness();
    const clientA = await insertClient(t, {
      name: "Client A",
      portalClerkId: "portal-a",
      orgId: "org-a",
    });
    const corruptDeclarationId = await insertDeclaration(t, {
      clientId: clientA,
      orgId: "org-b",
      userId: "broker-b",
      mrn: "FOREIGN-SECRET-MRN",
    });
    const corruptRequirementId = await insertRequirement(t, corruptDeclarationId);
    const clientDocumentId = await insertDocument(t, {
      fileId: await storeFile(t, "client-owned-corrupt-link"),
      fileName: "client-owned-corrupt-link.pdf",
      fileType: "N935",
      clientId: clientA,
      declarationId: corruptDeclarationId,
      orgId: "org-a",
      userId: "portal-a",
    });

    const portalA = t.withIdentity(portalIdentity("portal-a"));
    const [declarations, detail, requirements, exactRequirement, documents] = await Promise.all([
      portalA.query(api.client_portal.listMyDeclarations, {}),
      portalA.query(api.client_portal.getMyDeclaration, {
        declarationId: corruptDeclarationId,
      }),
      portalA.query(api.client_portal.listMyDocumentRequirements, {}),
      portalA.query(api.client_portal.getMyDocumentRequirement, {
        requirementId: String(corruptRequirementId),
      }),
      portalA.query(api.client_portal.listMyDocuments, {}),
    ]);

    expect(declarations.some((row) => row._id === corruptDeclarationId)).toBe(false);
    expect(detail).toBeNull();
    expect(requirements.some((row) => row._id === corruptRequirementId)).toBe(false);
    expect(exactRequirement).toBeNull();

    const visibleDocument = documents.find((row) => row._id === clientDocumentId);
    expect(visibleDocument).toMatchObject({
      _id: clientDocumentId,
      declarationId: null,
      mrn: null,
    });
    expect(documents.some((row) => row.declarationId === corruptDeclarationId)).toBe(false);
    expect(documents.some((row) => row.mrn === "FOREIGN-SECRET-MRN")).toBe(false);
  });
});
