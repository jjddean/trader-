"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExportLicencesPanelProps {
  assessmentId: Id<"export_assessments">;
}

function formatRecordedAt(ts: number) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExportLicencesPanel({ assessmentId }: ExportLicencesPanelProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const detail = useQuery(
    api.export_controls.getAssessment,
    canQuery ? { assessmentId } : "skip",
  );
  const recordLicence = useMutation(api.export_controls.recordExportLicence);

  const [licenceType, setLicenceType] = useState<"siel" | "f680" | "other">("siel");
  const [applicationRef, setApplicationRef] = useState("");
  const [licenceRef, setLicenceRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessment = detail?.assessment;
  const licences = detail?.licences ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canQuery || !applicationRef.trim() && !licenceRef.trim()) {
      setError("Enter an application reference and/or licence number.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await recordLicence({
        assessmentId,
        licenceType,
        applicationRef: applicationRef.trim() || undefined,
        licenceRef: licenceRef.trim() || undefined,
        route: assessment?.submissionRoute,
      });
      setApplicationRef("");
      setLicenceRef("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record licence");
    } finally {
      setSaving(false);
    }
  };

  if (!detail) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading licences…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-black">Record GOV.UK submission</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          After submitting on the official GOV.UK service, record your application reference here. When ECJU issues a
          licence, add the licence number. FreightCode does not submit on your behalf.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="licence-type" className="text-[11px] font-medium text-slate-600">
              Licence type
            </label>
            <Select
              value={licenceType}
              onValueChange={(value) => setLicenceType(value as "siel" | "f680" | "other")}
            >
              <SelectTrigger
                id="licence-type"
                className="mt-1 h-9 w-full border-slate-200 bg-white text-xs text-slate-800"
              >
                <SelectValue placeholder="Select licence type" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[110]">
                <SelectItem value="siel" className="text-xs">
                  SIEL
                </SelectItem>
                <SelectItem value="f680" className="text-xs">
                  F680
                </SelectItem>
                <SelectItem value="other" className="text-xs">
                  Other
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="application-ref" className="text-[11px] font-medium text-slate-600">
              Application reference
            </label>
            <input
              id="application-ref"
              type="text"
              value={applicationRef}
              onChange={(e) => setApplicationRef(e.target.value)}
              placeholder="e.g. from LITE confirmation email"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label htmlFor="licence-ref" className="text-[11px] font-medium text-slate-600">
              Licence number (when issued)
            </label>
            <input
              id="licence-ref"
              type="text"
              value={licenceRef}
              onChange={(e) => setLicenceRef(e.target.value)}
              placeholder="e.g. SIEL reference from ECJU"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-slate-400"
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canQuery || saving}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Record reference
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-black">Recorded licences</h2>
        {licences.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">No references recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {licences
              .slice()
              .sort((a, b) => b.recordedAt - a.recordedAt)
              .map((licence) => (
                <li key={licence._id} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                      {licence.licenceType}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatRecordedAt(licence.recordedAt)}</span>
                  </div>
                  {licence.applicationRef && (
                    <p className="mt-2 text-xs text-slate-700">
                      <span className="text-slate-500">Application:</span>{" "}
                      <span className="font-mono font-medium">{licence.applicationRef}</span>
                    </p>
                  )}
                  {licence.licenceRef && (
                    <p className="mt-1 text-xs text-slate-700">
                      <span className="text-slate-500">Licence:</span>{" "}
                      <span className="font-mono font-medium">{licence.licenceRef}</span>
                    </p>
                  )}
                  {licence.route && (
                    <p className="mt-1 text-[11px] text-slate-400">Route: {licence.route.toUpperCase()}</p>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
