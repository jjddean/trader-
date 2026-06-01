"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useConvexAuth, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { ShieldCheck, Send, Loader2, AlertTriangle, CheckCircle2, Code2 } from "lucide-react";
import { mapToCDS_H1 } from "@/lib/wco-mapper";
import { generateClientFraudHeaders } from "@/lib/hmrc-fraud-headers";
import { getHmrcRequirementSetForDeclaration } from "@/lib/utils/document-utils";

export default function SubmitPage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const declarationId = params?.id as Id<"declarations">;
  
  const declaration = useQuery(
    api.declarations.getLane,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && declarationId ? { id: declarationId } : "skip",
  );
  const items = useQuery(
    api.goods_items.getItems,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && declarationId ? { declarationId } : "skip",
  );
  const requirements = useQuery(
    api.documents.getDocumentRequirements,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && declarationId ? { declarationId } : "skip",
  );
  const upsertRequirementsForDeclaration = useMutation(api.documents.upsertRequirementsForDeclaration);

  const hmrcTokens = useQuery(
    api.hmrc_internal.getTokens,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && userId ? { userId } : "skip",
  );
  const hydratedRequirementsRef = useRef(false);

  type ActionableFailure = {
    action: "provide-document" | "declare-exemption" | "fix-field" | "remove-document" | "fix-predicate";
    oneOf?: string[];
    field?: string;
    severity: "blocking" | "advisory";
    reason: string;
    causedBy: { ruleIds: string[]; measureIds: string[] };
    sources?: Array<"core" | "tariff" | "curated">;
  };
  const sourceLabel = (s: "core" | "tariff" | "curated") =>
    s === "tariff" ? "Tariff" : s === "curated" ? "CDS (Observed)" : "Core";
  const sourceClass = (s: "core" | "tariff" | "curated") =>
    s === "tariff"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : s === "curated"
      ? "bg-purple-50 text-purple-700 border-purple-200"
      : "bg-gray-100 text-gray-700 border-gray-200";
  type DryRunPayload = {
    success: boolean;
    localPreflight?: Record<string, string | undefined>;
    actionableFailures?: ActionableFailure[];
    ruleResults?: Array<{ ruleId: string; ruleName: string; severity: string; status: string; source?: string; measureId?: string; reason?: string }>;
    payloadDebug?: {
      declaration?: {
        borderTransportMeans?: { ID?: string; IdentificationTypeCode?: string; ModeCode?: string } | null;
        ucr?: string;
        declarationOfficeId?: string;
        functionalReferenceId?: string;
      };
      goodsShipment?: {
        exportCountryId?: string;
        sellerCountryCode?: string;
        buyerCountryCode?: string;
        destinationCountryCode?: string;
        consignment?: {
          arrivalTransportMeans?: { ID?: string; IdentificationTypeCode?: string; ModeCode?: string } | null;
          goodsLocationId?: string;
          goodsLocationName?: string;
          goodsLocationTypeCode?: string;
          goodsLocationAddressTypeCode?: string;
          goodsLocationCountryCode?: string;
        };
      };
      items?: Array<{
        sequenceNumeric?: string;
        governmentProcedures?: Array<{ CurrentCode?: string; PreviousCode?: string }>;
        additionalInformation?: Array<{ StatementCode?: string; StatementDescription?: string; StatementTypeCode?: string }>;
        additionalDocuments?: Array<{ CategoryCode?: string; TypeCode?: string; ID?: string; StatusCode?: string }>;
        packaging?: Array<{ MarksNumbersID?: string; QuantityQuantity?: string; TypeCode?: string }>;
        origin?: { CountryCode?: string; TypeCode?: string } | null;
      }>;
    };
    xmlPayload?: string;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunPayload | null>(null);
  const [dryRunPassed, setDryRunPassed] = useState(false);

  const readResponsePayload = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      const text = await res.text();
      return { error: text || `HTTP ${res.status}` };
    }
  };

  useEffect(() => {
    if (!declarationId || !declaration) return;
    if (hydratedRequirementsRef.current) return;
    const requiredDocs = getHmrcRequirementSetForDeclaration(declaration);
    if (requiredDocs.length === 0) return;

    hydratedRequirementsRef.current = true;
    void upsertRequirementsForDeclaration({
      declarationId,
      requirements: requiredDocs,
    }).catch(() => {
      hydratedRequirementsRef.current = false;
    });
  }, [declarationId, declaration, upsertRequirementsForDeclaration]);

  // Pre-flight validation checks
  const missingEori = !declaration?.eori;
  const noItems = !items || items.length === 0;
  const missingHS = items?.some((i: any) => !i.commodityCode);
  const missingBlockingRequirements = (requirements || []).filter(
    (req: any) => req.status === "missing" && (req.requirementLevel || "blocking") === "blocking",
  );
  const missingAdvisoryRequirements = (requirements || []).filter(
    (req: any) => req.status === "missing" && (req.requirementLevel || "blocking") === "advisory",
  );
  const missingBlockingCodes = missingBlockingRequirements
    .map((req: any) => String(req.code || "UNKNOWN"));
  const missingAdvisoryCodes = missingAdvisoryRequirements
    .map((req: any) => String(req.code || "UNKNOWN"));

  const isReady = !missingEori && !noItems && !missingHS && missingBlockingRequirements.length === 0;
  
  // Generate the WCO payload for preview
  const wcoPayloadPreview = isReady ? mapToCDS_H1(declaration, items) : null;
  const debugGoodsLocation = dryRunResult?.payloadDebug?.goodsShipment?.consignment;
  const goodsLocationDisplay = [
    debugGoodsLocation?.goodsLocationCountryCode,
    debugGoodsLocation?.goodsLocationTypeCode,
    debugGoodsLocation?.goodsLocationAddressTypeCode,
    debugGoodsLocation?.goodsLocationName || debugGoodsLocation?.goodsLocationId,
  ].filter(Boolean).join(" / ");

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    setDryRunResult(null);
    setDryRunPassed(false);

    try {
      if (!isAuthenticated) {
        throw new Error("Convex session not authenticated. Please refresh and sign in again.");
      }
      // 1. Verify OAuth Token Status before attempting
      if (!hmrcTokens || Date.now() > (hmrcTokens.expiresAt ?? 0)) {
        throw new Error("HMRC Developer Hub OAuth token is missing or expired. Please reconnect in Settings.");
      }

      // 2. Call the Next.js API route that handles the actual WCO mapping and POST to HMRC
      const fraudHeaders = generateClientFraudHeaders(userId || undefined);
      const res = await fetch("/api/hmrc/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...fraudHeaders,
        },
        body: JSON.stringify({
          declarationId,
          eori: declaration?.eori,
          type: declaration?.declarationType,
          items: items,
        }),
      });

      const data = await readResponsePayload(res);

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
          : (data.message
              ? `${data.error || "Request failed"}\n\n${data.message}`
              : `${data.error || "HMRC API rejected the submission payload."}\n\nHTTP ${res.status}`);
        throw new Error(errorMessage);
      }

      // 3. Advance to Status timeline page to await the MRN webhook
      router.push(`/dashboard/declarations/${declarationId}/status`);

    } catch (err: any) {
      console.error("Submission failed:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDryRun = async () => {
    setIsDryRunning(true);
    setError(null);
    setDryRunResult(null);

    try {
      if (!isAuthenticated) {
        throw new Error("Convex session not authenticated. Please refresh and sign in again.");
      }
      if (!hmrcTokens || Date.now() > (hmrcTokens.expiresAt ?? 0)) {
        throw new Error("HMRC Developer Hub OAuth token is missing or expired. Please reconnect in Settings.");
      }

      const fraudHeaders = generateClientFraudHeaders(userId || undefined);
      const res = await fetch("/api/hmrc/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...fraudHeaders,
        },
        body: JSON.stringify({
          declarationId,
          eori: declaration?.eori,
          type: declaration?.declarationType,
          items: items,
          dryRunOnly: true,
        }),
      });

      const data = await readResponsePayload(res);
      if (!res.ok) {
        const failedChecks = Array.isArray(data.failedChecks) ? `\n${data.failedChecks.join(", ")}` : "";
        const missingHeaders = Array.isArray(data.missingHeaders) ? `\n${data.missingHeaders.join(", ")}` : "";
        const fieldErrors = Array.isArray(data.fields)
          ? "\n\n" + data.fields
              .map((fe: { field?: string; reason?: string }) => `• ${fe.field || "unknown"}: ${fe.reason || "Validation error"}`)
              .join("\n")
          : "";
        const message = data.message ? `\n${data.message}` : "";
        throw new Error(`${data.error || "Dry run failed"}${message}${failedChecks}${missingHeaders}${fieldErrors}\nHTTP ${res.status}`);
      }

      setDryRunResult(data as DryRunPayload);
      setDryRunPassed(data.success === true);
    } catch (err: any) {
      setError(err.message || "Dry run failed");
      setDryRunPassed(false);
    } finally {
      setIsDryRunning(false);
    }
  };

  if (!isLoaded || isConvexAuthLoading || (isSignedIn && isAuthenticated && (declaration === undefined || items === undefined || requirements === undefined))) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <h4 className="text-xs font-bold text-red-800 uppercase tracking-widest mb-1">HMRC API Error</h4>
        <p className="text-sm text-red-700 font-mono whitespace-pre-wrap">Session expired or not signed in. Please sign in again and retry.</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <h4 className="text-xs font-bold text-red-800 uppercase tracking-widest mb-1">HMRC API Error</h4>
        <p className="text-sm text-red-700 font-mono whitespace-pre-wrap">Convex authentication is not active for this session. Refresh the page and sign in again.</p>
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
        <p className="mt-2 inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          Pre-flight pass means structurally ready to submit. It does not guarantee HMRC acceptance.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 space-y-6">
          
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Pre-flight Validation</h3>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
              isReady && dryRunPassed ? "bg-green-100 text-green-700"
              : isReady ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"
            }`}>
              {isReady && dryRunPassed ? "Ready to Submit" : isReady ? "Awaiting Dry Run" : "Action Required"}
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

            <li className="flex items-start gap-3">
              {missingBlockingRequirements.length > 0 ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-medium ${missingBlockingRequirements.length > 0 ? "text-red-700" : "text-gray-900"}`}>Required Documents (Blocking)</p>
                <p className="text-xs text-gray-500">
                  Submit gate is based on persisted declaration requirements.
                  {missingBlockingCodes.length > 0 ? ` Missing: ${missingBlockingCodes.join(", ")}` : ""}
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              {missingAdvisoryRequirements.length > 0 ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-medium ${missingAdvisoryRequirements.length > 0 ? "text-amber-700" : "text-gray-900"}`}>Advisory Evidence</p>
                <p className="text-xs text-gray-500">
                  Advisory documents do not block submit but should be resolved.
                  {missingAdvisoryCodes.length > 0 ? ` Missing: ${missingAdvisoryCodes.join(", ")}` : ""}
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              {!dryRunPassed ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-medium ${!dryRunPassed ? "text-amber-700" : "text-gray-900"}`}>Dry Run Gate</p>
                <p className="text-xs text-gray-500">Run and pass the local dry check before submitting to HMRC.</p>
              </div>
            </li>
          </ul>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
               <h4 className="text-xs font-bold text-red-800 uppercase tracking-widest mb-1">HMRC API Error</h4>
               <p className="text-sm text-red-700 font-mono whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {dryRunResult && (
            <div className="space-y-3">
              <div className={`rounded-md border p-4 ${dryRunResult.success ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                <h4 className={`text-xs font-bold uppercase tracking-widest mb-2 ${dryRunResult.success ? "text-green-800" : "text-amber-800"}`}>
                  Dry Run {dryRunResult.success ? "Passed" : "Completed"}
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {Object.entries(dryRunResult.localPreflight || {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-gray-600">{k}</span>
                      <span className={`font-mono font-semibold ${
                        v === "pass" ? "text-green-700"
                        : v === "blocked" || v === "fail" ? "text-red-700"
                        : v === "advisory" ? "text-amber-700"
                        : "text-gray-500"
                      }`}>{v ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(dryRunResult.actionableFailures?.length ?? 0) > 0 && (
                <div className="rounded-md border border-gray-200 bg-white p-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-3">
                    Actions Required ({dryRunResult.actionableFailures!.length})
                  </h4>
                  <ul className="space-y-3">
                    {dryRunResult.actionableFailures!.map((af, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                        <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                          af.severity === "blocking" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {af.severity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-900">
                            {af.action.replace(/-/g, " ")}
                            {af.field ? <span className="ml-2 font-mono text-gray-500">[{af.field}]</span> : null}
                          </p>
                          <p className="text-xs text-gray-700 mt-0.5">{af.reason}</p>
                          {af.oneOf && af.oneOf.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {af.oneOf.map((c) => (
                                <span key={c} className="inline-flex items-center rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                          {(af.sources?.length ?? 0) > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {af.sources!.map((s) => (
                                <span
                                  key={s}
                                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${sourceClass(s)}`}
                                >
                                  {sourceLabel(s)}
                                </span>
                              ))}
                            </div>
                          )}
                          {af.causedBy.measureIds.length > 0 && (
                            <p className="mt-1.5 text-[10px] text-gray-500">
                              Tariff measure{af.causedBy.measureIds.length > 1 ? "s" : ""}: {af.causedBy.measureIds.join(", ")}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(dryRunResult.payloadDebug || dryRunResult.xmlPayload) && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-blue-800">
                    Live CDS Payload Debug
                  </h4>

                  {dryRunResult.payloadDebug && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded border border-blue-100 bg-white p-3">
                        <p className="text-[11px] font-semibold text-gray-900 mb-2">Declaration / Transport</p>
                        <div className="space-y-1 text-[11px] font-mono text-gray-700">
                          <div>LRN: {dryRunResult.payloadDebug.declaration?.functionalReferenceId || "—"}</div>
                          <div>Office: {dryRunResult.payloadDebug.declaration?.declarationOfficeId || "—"}</div>
                          <div>UCR: {dryRunResult.payloadDebug.declaration?.ucr || "—"}</div>
                          <div>BTM ID: {dryRunResult.payloadDebug.declaration?.borderTransportMeans?.ID || "—"}</div>
                          <div>BTM Type: {dryRunResult.payloadDebug.declaration?.borderTransportMeans?.IdentificationTypeCode || "—"}</div>
                          <div>BTM Mode: {dryRunResult.payloadDebug.declaration?.borderTransportMeans?.ModeCode || "—"}</div>
                          <div>ATM ID: {dryRunResult.payloadDebug.goodsShipment?.consignment?.arrivalTransportMeans?.ID || "—"}</div>
                          <div>ATM Type: {dryRunResult.payloadDebug.goodsShipment?.consignment?.arrivalTransportMeans?.IdentificationTypeCode || "—"}</div>
                          <div>ATM Mode: {dryRunResult.payloadDebug.goodsShipment?.consignment?.arrivalTransportMeans?.ModeCode || "—"}</div>
                          <div>Goods Location: {goodsLocationDisplay || "—"}</div>
                        </div>
                      </div>

                      <div className="rounded border border-blue-100 bg-white p-3">
                        <p className="text-[11px] font-semibold text-gray-900 mb-2">Countries / Parties</p>
                        <div className="space-y-1 text-[11px] font-mono text-gray-700">
                          <div>Export Country: {dryRunResult.payloadDebug.goodsShipment?.exportCountryId || "—"}</div>
                          <div>Seller Country: {dryRunResult.payloadDebug.goodsShipment?.sellerCountryCode || "—"}</div>
                          <div>Buyer Country: {dryRunResult.payloadDebug.goodsShipment?.buyerCountryCode || "—"}</div>
                          <div>Destination: {dryRunResult.payloadDebug.goodsShipment?.destinationCountryCode || "—"}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {dryRunResult.payloadDebug?.items?.map((item, index) => (
                    <div key={index} className="rounded border border-blue-100 bg-white p-3">
                      <p className="text-[11px] font-semibold text-gray-900 mb-2">
                        Item {item.sequenceNumeric || String(index + 1)}
                      </p>
                      <div className="space-y-2 text-[11px]">
                        <div>
                          <span className="font-medium text-gray-700">Government Procedures:</span>{" "}
                          <span className="font-mono text-gray-700">
                            {(item.governmentProcedures || [])
                              .map((proc) => proc.PreviousCode ? `${proc.CurrentCode}/${proc.PreviousCode}` : `${proc.CurrentCode}`)
                              .join(", ") || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Additional Information:</span>{" "}
                          <span className="font-mono text-gray-700">
                            {(item.additionalInformation || [])
                              .map((ai) => ai.StatementCode)
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Additional Documents:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(item.additionalDocuments || []).length > 0 ? (
                              item.additionalDocuments!.map((doc, docIndex) => (
                                <span key={docIndex} className="inline-flex items-center rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
                                  {(doc.CategoryCode || "") + (doc.TypeCode || "")}:{doc.ID || "—"}{doc.StatusCode ? `:${doc.StatusCode}` : ""}
                                </span>
                              ))
                            ) : (
                              <span className="font-mono text-gray-500">—</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Packaging:</span>{" "}
                          <span className="font-mono text-gray-700">
                            {(item.packaging || [])
                              .map((pkg) => `${pkg.TypeCode || "—"} / ${pkg.QuantityQuantity || "—"} / ${pkg.MarksNumbersID || "—"}`)
                              .join(", ") || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Origin:</span>{" "}
                          <span className="font-mono text-gray-700">{item.origin?.CountryCode || "—"}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {dryRunResult.xmlPayload && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-900 mb-2">Exact XML Sent On Submit</p>
                      <div className="rounded-md bg-gray-900 p-4 max-h-96 overflow-y-auto w-full">
                        <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all">
                          {dryRunResult.xmlPayload}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
            onClick={handleDryRun}
            disabled={!isReady || isSubmitting || isDryRunning}
            className="flex w-full h-8 rounded-md border border-gray-300 bg-white px-4 text-xs font-normal text-gray-800 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 items-center justify-center gap-2"
          >
            {isDryRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-4 w-4 text-blue-600" />}
            {isDryRunning ? "Running Local Dry Check..." : "Run Local Dry Check (No HMRC Call)"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isReady || !dryRunPassed || isSubmitting || isDryRunning}
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
