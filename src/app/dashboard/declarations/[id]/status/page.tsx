"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Activity, Clock, CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert, FileText, AlertCircle } from "lucide-react";

export default function StatusTimelinePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"declarations">;
  
  const declaration = useQuery(api.declarations.getLane, id ? { id } : "skip");
  
  // Fetch real-time webhook notifications using MRN or Conversation ID
  const notifications = useQuery(
    api.notifications.getWebhooks, 
    declaration ? { mrn: declaration.mrn, conversationId: declaration.conversationId } : "skip"
  );

  if (declaration === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!declaration) {
    return null;
  }

  const isSubmitted = declaration.status !== "Draft";
  const notificationMeta: Record<string, { title: string; color: string; icon: "success" | "warning" | "danger" | "info"; detail: string }> = {
    DMSUB: { title: "Declaration received by HMRC", color: "bg-blue-500", icon: "info", detail: "Declaration has been received and queued by HMRC." },
    DMSACC: { title: "Declaration accepted", color: "bg-green-500", icon: "success", detail: "Declaration passed initial controls and is accepted." },
    DMSCLE: { title: "Goods cleared", color: "bg-green-500", icon: "success", detail: "Goods are cleared for release." },
    DMSROG: { title: "Route to examine", color: "bg-amber-500", icon: "warning", detail: "HMRC routed this declaration for examination. Action required." },
    DMSREJ: { title: "Declaration rejected", color: "bg-red-500", icon: "danger", detail: "HMRC rejected the declaration. Review error codes and amend." },
    DMSINV: { title: "Declaration invalid", color: "bg-red-500", icon: "danger", detail: "HMRC returned field-level validation errors." },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Customs Status Timeline</h2>
        <p className="mt-1 text-xs text-gray-500">
          Real-time webhook notifications pushed from HMRC Customs Declarations Service.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        {!isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="mb-4 h-8 w-8 text-gray-300" />
            <h3 className="text-sm font-medium text-gray-900">Awaiting Submission</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              The declaration must be submitted and receive an MRN before HMRC can route status webhooks.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                  MRN
                </p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {declaration.mrn || "— pending"}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                  CDS Status
                </p>
                <div>
                  {Boolean(declaration.mrn && String(declaration.mrn).trim().length > 0) && (declaration.status === "Cleared" || declaration.status === "Accepted") ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                      <ShieldCheck className="h-3 w-3" />
                      {declaration.status === "Accepted" ? "Accepted (DMSACC)" : "Cleared (DMSCLE)"}
                    </span>
                  ) : declaration.status === "Rejected" || declaration.status === "Action Required" || declaration.status === "Invalid" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                      <ShieldAlert className="h-3 w-3" />
                      {declaration.status === "Rejected" ? "Rejected (DMSREJ)" : declaration.status === "Invalid" ? "Invalid (DMSINV)" : declaration.status}
                    </span>
                  ) : declaration.status === "Draft" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-700">
                      <FileText className="h-3 w-3" />
                      {declaration.status}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700">
                      <AlertCircle className="h-3 w-3" />
                      {declaration.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                  Last Update
                </p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                   {new Date(declaration.lastUpdated || declaration._creationTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="relative pl-6">
              <div className="absolute left-[11px] top-2 h-full w-px bg-gray-200" />
              
              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {new Date(declaration.lastUpdated || declaration._creationTime).toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-gray-900">Declaration Submitted</p>
                    <p className="text-xs text-gray-600">Payload successfully validated and stored by HMRC Hub.</p>
                  </div>
                </div>

                {(notifications || []).map((notif: any) => (
                  <div key={notif._id} className="relative">
                    <div className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white ${
                      notificationMeta[notif.notificationType]?.color || "bg-blue-500"
                    }`} />
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {new Date(notif.timestamp).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                         <p className="text-sm font-medium text-gray-900">
                           {notificationMeta[notif.notificationType]?.title || `Status Update (${notif.notificationType})`}
                         </p>
                         {notificationMeta[notif.notificationType]?.icon === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                         {notificationMeta[notif.notificationType]?.icon === "danger" && <XCircle className="h-4 w-4 text-red-500" />}
                         {notificationMeta[notif.notificationType]?.icon === "warning" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                      </div>
                      <p className="text-xs text-gray-600">
                        {notificationMeta[notif.notificationType]?.detail || "HMRC sent a status update."}
                      </p>
                      {(notif.notificationType === "DMSREJ" || notif.notificationType === "DMSINV") && Array.isArray(notif.fieldErrors) && notif.fieldErrors.length > 0 && (
                        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                          {notif.fieldErrors.map((fieldError: { field: string; code?: string; reason: string }, idx: number) => (
                            <p key={`${notif._id}-err-${idx}`} className="break-words">
                              {fieldError.field}: {fieldError.reason}{fieldError.code ? ` (${fieldError.code})` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                      {(notif.notificationType === "DMSREJ" || notif.notificationType === "DMSINV") && (!Array.isArray(notif.fieldErrors) || notif.fieldErrors.length === 0) && Array.isArray(notif.errorCodes) && notif.errorCodes.length > 0 && (
                        <p className="text-xs text-red-700 break-words">
                          {notif.errorCodes.join(", ")}
                        </p>
                      )}
                      <details className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 cursor-pointer">
                        <summary className="font-mono text-[10px] font-semibold hover:text-gray-900">View Raw XML Payload</summary>
                        <pre className="mt-2 overflow-x-auto p-2 bg-gray-900 text-green-400 rounded font-mono text-[10px] whitespace-pre-wrap max-h-96">
                          {notif.rawPayload}
                        </pre>
                      </details>
                    </div>
                  </div>
                ))}
                
                {(!notifications || notifications.length === 0) && (
                   <div className="relative pt-2">
                     <div className="absolute -left-6 top-3 h-3 w-3 rounded-full border-2 border-white bg-gray-200" />
                     <div className="flex items-center gap-2 text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm italic">Awaiting further routing updates from HMRC...</span>
                     </div>
                   </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
