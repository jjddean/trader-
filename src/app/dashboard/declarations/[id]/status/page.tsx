"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Activity, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
            <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4 border border-gray-100">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Listening on {declaration.mrn || declaration.conversationId || "Polling"}</p>
                <p className="text-xs text-gray-500">Webhook endpoint actively receiving push notifications.</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-green-600">Live</span>
              </div>
            </div>

            <div className="relative pl-6">
              <div className="absolute left-[11px] top-2 h-full w-px bg-gray-200" />
              
              <div className="space-y-6">
                {/* Initial Receipt Status (Mocked/Derived from DB creation) */}
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

                {/* Real-time Webhooks Array */}
                {(notifications || []).map((notif: any) => (
                  <div key={notif._id} className="relative">
                    <div className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white ${
                      notif.notificationType === 'CLEARED' ? 'bg-green-500' :
                      notif.notificationType === 'REJECTED' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {new Date(notif.timestamp).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                         <p className="text-sm font-medium text-gray-900">
                           {notif.notificationType === 'CLEARED' ? 'Goods Cleared (DMSCLE)' :
                            notif.notificationType === 'REJECTED' ? 'Declaration Rejected (DMSREJ)' :
                            notif.notificationType === 'ACCEPTED' ? 'Declaration Accepted (DMSACC)' :
                            `Status Update (${notif.notificationType})`}
                         </p>
                         {notif.notificationType === 'CLEARED' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                         {notif.notificationType === 'REJECTED' && <XCircle className="h-4 w-4 text-red-500" />}
                      </div>
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
