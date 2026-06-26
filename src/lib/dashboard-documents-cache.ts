type DocumentsSnapshot = {
  userId: string;
  declarationFilter: string;
  dbDocuments: Array<Record<string, unknown>>;
  requirements: Array<Record<string, unknown>>;
  allDeclarations: Array<Record<string, unknown>>;
};

let snapshot: DocumentsSnapshot | null = null;

export function rememberDocumentsSnapshot(data: DocumentsSnapshot) {
  snapshot = data;
}

export function getRememberedDocumentsSnapshot(
  userId: string,
  declarationFilter: string,
): Omit<DocumentsSnapshot, "userId" | "declarationFilter"> | null {
  if (!snapshot || snapshot.userId !== userId || snapshot.declarationFilter !== declarationFilter) {
    return null;
  }
  return {
    dbDocuments: snapshot.dbDocuments,
    requirements: snapshot.requirements,
    allDeclarations: snapshot.allDeclarations,
  };
}

export function clearDocumentsSnapshot() {
  snapshot = null;
}
