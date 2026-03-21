"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { ShieldCheck, Send, Loader2, AlertTriangle, CheckCircle2, Code2 } from "lucide-react";
import { mapToCDS_H1 } from "@/lib/wco-mapper";

export default function SubmitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const declarationId = params?.id as Id<"declarations">;
  
  const declaration = useQuery(api.declarations.getLane, declarationId ? { id: declarationId } : "skip");
  const items = useQuery(api.goods_items.getItems, declarationId ? { declarationId } : "skip");
  
  // Note: These mutations map to our existing Convex logic
  const updateStatus = useMutation(api.declarations.updateDeclarationStatus);
  const checkHmrcStatus = useAction(api.actions.hmrc.getHmrcStatus);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-flight validation checks
  const missingEori = !declaration?.eori;
  const noItems = !items || items.length === 0;
  const missingHS = items?.some((i: any) => !i.commodityCode);
  
  const isReady = !missingEori && !noItems && !missingHS;
  
  // Generate the WCO payload for preview
  const wcoPayloadPreview = isReady ? mapToCDS_H1(declaration, items) : null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Verify OAuth Token Status before attempting
      const oauthStatus = await checkHmrcStatus();
      if (!oauthStatus.connected || oauthStatus.isExpired) {
        throw new Error("HMRC Developer Hub OAuth token is missing or expired. Please reconnect in Settings.");
      }

      // 2. Call the Next.js API route that handles the actual WCO mapping and POST to HMRC
      const res = await fetch("/api/hmrc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          declarationId,
          eori: declaration?.eori,
          type: declaration?.declarationType,
          items: items,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.log("HMRC validation details:", data.details, data.fields);
        const fieldErrors = Array.isArray(data.fields)
          ? data.fields
              .map((fieldErr: { field?: string; reason?: string }) => `${fieldErr.field || "unknown"}: ${fieldErr.reason || "Validation error"}`)
              .join("\n")
          : "";
        const errorMessage = data.details 
          ? `${data.error}\n\n${data.details}`
          : fieldErrors
            ? `${data.error || "Validation failed"}\n\n${fieldErrors}`
          : (data.error || "HMRC API rejected the submission payload.");
        throw new Error(errorMessage);
      }

      // 3. Automatically advance the user to the Status timeline page where they await the MRN webhook
      await updateStatus({ id: declarationId, status: "Submitted" });
      router.push(`/dashboard/declarations/${declarationId}/status`);

    } catch (err: any) {
      console.error("Submission failed:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (declaration === undefined || items === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Validate & Submit</h2>
        <p className="mt-1 text-xs text-gray-500">
          Run final pre-flight checks before pushing the WCO 3.6 payload to the HMRC Customs Declarations API.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 space-y-6">
          
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Pre-flight Validation</h3>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${isReady ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {isReady ? "Ready to Submit" : "Action Required"}
            </span>
          </div>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              {missingEori ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-medium ${missingEori ? "text-red-700" : "text-gray-900"}`}>Declarant EORI</p>
                <p className="text-xs text-gray-500">A valid EORI must be provided in the Core Schema.</p>
              </div>
            </li>
            
            <li className="flex items-start gap-3">
              {noItems ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-medium ${noItems ? "text-red-700" : "text-gray-900"}`}>Goods Items</p>
                <p className="text-xs text-gray-500">At least one goods item must be added to the declaration.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              {missingHS ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-medium ${missingHS ? "text-red-700" : "text-gray-900"}`}>HS Commodity Codes</p>
                <p className="text-xs text-gray-500">All goods items must have a valid 10-digit HS Code.</p>
              </div>
            </li>
          </ul>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
               <h4 className="text-xs font-bold text-red-800 uppercase tracking-widest mb-1">HMRC API Error</h4>
               <p className="text-sm text-red-700 font-mono whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {wcoPayloadPreview && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Code2 className="h-5 w-5 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900">WCO 3.6 Payload Preview</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                This is the exact JSON structure that will be transmitted to the HMRC Customs Declarations API.
              </p>
              <div className="rounded-md bg-gray-900 p-4 max-h-96 overflow-y-auto w-full">
                <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(wcoPayloadPreview, null, 2)}
                </pre>
              </div>
            </div>
          )}

        </div>

        <div className="border-t border-gray-100 bg-gray-50/50 p-4 px-6 flex flex-col items-center justify-center gap-3">
          <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-medium">
            By submitting, you confirm authorization to act as the legal Declarant.
          </p>
          <button
            onClick={handleSubmit}
            disabled={!isReady || isSubmitting}
            className="flex w-full h-8 rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4 text-green-400" />}
            {isSubmitting ? "Transmitting to HMRC..." : "Submit to Customs Declarations API"}
          </button>
        </div>
      </div>
    </div>
  );
}
