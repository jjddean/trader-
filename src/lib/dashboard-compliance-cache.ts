type ReportRow = Record<string, unknown>;
type TreImportRow = Record<string, unknown>;
type FinancialRecordRow = Record<string, unknown>;

let reportsSnapshot: { userId: string; reports: ReportRow[]; treImports: TreImportRow[] } | null = null;
let recordsSnapshot: { userId: string; records: FinancialRecordRow[] } | null = null;

export function rememberReportsSnapshot(userId: string, reports: ReportRow[], treImports: TreImportRow[]) {
  reportsSnapshot = { userId, reports, treImports };
}

export function getRememberedReportsSnapshot(userId: string) {
  if (!reportsSnapshot || reportsSnapshot.userId !== userId) return null;
  return { reports: reportsSnapshot.reports, treImports: reportsSnapshot.treImports };
}

export function rememberRecordsSnapshot(userId: string, records: FinancialRecordRow[]) {
  recordsSnapshot = { userId, records };
}

export function getRememberedRecordsSnapshot(userId: string) {
  if (!recordsSnapshot || recordsSnapshot.userId !== userId) return null;
  return { records: recordsSnapshot.records };
}

export function clearComplianceSnapshots() {
  reportsSnapshot = null;
  recordsSnapshot = null;
}
