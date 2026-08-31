import type { CodeListDryRunStatus } from "./submit-code-list-status";

export type DryRunLocalPreflight = {
  fraudHeaders: "pass" | "fail";
  eoriConsistency: "pass" | "fail";
  xml: "pass" | "fail";
  xmlFailedChecks?: string[];
  token: "pass" | "fail" | "n/a";
  ruleEngine: "skipped" | "blocked" | "advisory" | "pass";
  codeLists: "checked" | "skipped";
  skippedCodeLists?: string[];
  unavailableCodeLists?: string[];
};

export const DRY_RUN_LOCAL_PREFLIGHT_ALWAYS_KEYS = [
  "fraudHeaders",
  "eoriConsistency",
  "xml",
  "token",
  "ruleEngine",
  "codeLists",
] as const;

export function buildDryRunLocalPreflight(args: {
  fraudHeadersPass: boolean;
  eoriConsistencyPass: boolean;
  xmlPass: boolean;
  xmlFailedChecks: string[];
  token: DryRunLocalPreflight["token"];
  ruleEngine: DryRunLocalPreflight["ruleEngine"];
  codeLists: CodeListDryRunStatus["codeLists"];
  skippedCodeLists?: string[];
  unavailableCodeLists?: string[];
}): DryRunLocalPreflight {
  return {
    fraudHeaders: args.fraudHeadersPass ? "pass" : "fail",
    eoriConsistency: args.eoriConsistencyPass ? "pass" : "fail",
    xml: args.xmlPass ? "pass" : "fail",
    ...(args.xmlFailedChecks.length > 0 ? { xmlFailedChecks: args.xmlFailedChecks } : {}),
    token: args.token,
    ruleEngine: args.ruleEngine,
    codeLists: args.codeLists,
    ...(args.skippedCodeLists && args.skippedCodeLists.length > 0
      ? { skippedCodeLists: args.skippedCodeLists }
      : {}),
    ...(args.unavailableCodeLists && args.unavailableCodeLists.length > 0
      ? { unavailableCodeLists: args.unavailableCodeLists }
      : {}),
  };
}
