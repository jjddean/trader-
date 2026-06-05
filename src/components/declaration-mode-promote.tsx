"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

interface CompletenessIssue {
  ruleId: string;
  field: string;
  reason: string;
}

interface DeclarationModePromoteProps {
  declarationId: Id<"declarations">;
  declarationMode?: string | null;
  missing: CompletenessIssue[];
}

function needsEnrichedPromotion(missing: CompletenessIssue[]): boolean {
  return missing.some(
    (m) =>
      m.ruleId === "MODE-MINIMAL-LOCK" ||
      m.field === "WILDCARD_FORBID_ALL_DOCUMENTS" ||
      m.reason.toLowerCase().includes("minimal mode"),
  );
}

export function DeclarationModePromote({
  declarationId,
  declarationMode,
  missing,
}: DeclarationModePromoteProps) {
  const setMode = useMutation(api.declarations.setDeclarationMode);
  const [busy, setBusy] = useState(false);

  const isMinimal = String(declarationMode || "minimal").trim().toLowerCase() !== "enriched";
  if (!isMinimal || !needsEnrichedPromotion(missing)) return null;

  return (
    <button
      type="button"
      disabled={busy}
      className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        try {
          await setMode({ id: declarationId, mode: "enriched" });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Enabling…
        </span>
      ) : (
        "Enable documents (enriched mode)"
      )}
    </button>
  );
}
