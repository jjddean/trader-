import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

type ReportRow = Record<string, unknown>;
type TreImportRow = Record<string, unknown>;
type FinancialRecordRow = FunctionReturnType<typeof api.declarations.getFinancialRecords>[number];
type AssessmentRow = FunctionReturnType<typeof api.export_controls.listAssessments>[number];

let reportsSnapshot: { userId: string; reports: ReportRow[]; treImports: TreImportRow[] } | null = null;
let recordsSnapshot: { userId: string; records: FinancialRecordRow[] } | null = null;
let assessmentsSnapshot: { userId: string; assessments: AssessmentRow[] } | null = null;

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

export function rememberAssessmentsSnapshot(userId: string, assessments: AssessmentRow[]) {
  assessmentsSnapshot = { userId, assessments };
}

export function getRememberedAssessmentsSnapshot(userId: string) {
  if (!assessmentsSnapshot || assessmentsSnapshot.userId !== userId) return null;
  return { assessments: assessmentsSnapshot.assessments };
}

export function clearComplianceSnapshots() {
  reportsSnapshot = null;
  recordsSnapshot = null;
  assessmentsSnapshot = null;
}
