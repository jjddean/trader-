"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Activity, Clock, CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert, FileText, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { normalizeNotificationType, getNotificationDisplay } from "@/lib/notification-labels";
import {
  declarationHasAmendStateBlocked,
  declarationHasImportDmscle,
  declarationHasInvalidationAccepted,
  isInvalidationAccepted,
  resolveDeclarationCdsBadge,
  resolveTimelineNotificationMeta,
  type CdsBadgeTone,
} from "@/lib/notification-context";
import { generateClientFraudHeaders } from "@/lib/hmrc-fraud-headers";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  ConvexSessionMissing,
  DeclarationPageSkeleton,
  isConvexSessionMissing,
} from "@/components/declaration-session-states";
import {
  normalizeRepresentationType,
  representationSummaryLabel,
} from "@/lib/representation-display";
import { cn } from "@/lib/utils";

type StatusTimelineNotification = {
  _id: string;
  timestamp?: string | number;
  notificationType?: string | null;
  rawPayload?: string | null;
  fieldErrors?: Array<{ field: string; code?: string; reason: string }>;
  errorCodes?: string[];
};

export default function StatusTimelinePage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"declarations">;
  
  const declaration = useQuery(
    api.declarations.getLane,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && id ? { id } : "skip",
  );
  
  const notifications = useQuery(
    api.notifications.getWebhooks,
    declaration
      ? {
          declarationId: id,
          conversationId: declaration.conversationId,
          mrn: declaration.mrn,
        }
      : "skip",
  );

  const submissions = useQuery(
    api.submissions.getSubmissions,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && id ? { declarationId: id } : "skip",
  );

  const auditLogs = useQuery(
    api.audit.getDeclarationAuditLogs,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && id ? { declarationId: id } : "skip",
  );

  const representationStatus = useQuery(
    api.representation.getStatus,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && id ? { declarationId: id } : "skip",
  );

  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [amendMenuOpen, setAmendMenuOpen] = useState(false);
  const [hmrcBusy, setHmrcBusy] = useState(false);
  const [hmrcMessage, setHmrcMessage] = useState<string | null>(null);
  const [hmrcMessageOk, setHmrcMessageOk] = useState(false);

  const hmrcFetchInit = (): RequestInit => ({
    headers: generateClientFraudHeaders(userId || undefined),
  });

  async function runHmrcAction(
    label: string,
    run: () => Promise<Response>,
    onSuccess?: (body: Record<string, unknown>) => void,
  ) {
    setHmrcBusy(true);
    setHmrcMessage(null);
    setHmrcMessageOk(false);
    try {
      const res = await run();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          typeof body.details === "string"
            ? body.details.slice(0, 280)
            : body.details
              ? JSON.stringify(body.details).slice(0, 280)
              : "";
        setHmrcMessage(
          `${label} failed (${res.status}): ${body.error || body.message || "unknown"}` +
            (detail ? ` — ${detail}` : ""),
        );
        setHmrcMessageOk(false);
        return;
      }
      setHmrcMessageOk(true);
      setHmrcMessage(
        `${label} OK (${res.status})` +
          (body.conversationId ? ` — conversation ${body.conversationId}` : "") +
          (label === "Cancel" ? " — await HMRC notification (DMSINV FC 02 = success)" : "") +
          (label === "Amend"
            ? " — stay on this Status tab; pull notifications for DMSRES or DMSINV"
            : "") +
          (body.saved != null
            ? ` — ${body.saved} notification(s) saved` +
              (typeof body.total === "number" && body.total > body.saved
                ? ` (${body.total} in HMRC queue)`
                : "") +
              (Array.isArray(body.conversations) && body.conversations.length > 1
                ? ` across ${body.conversations.length} conversations`
                : "") +
              (body.saved === 0
                ? " — queue empty or already pulled (check timeline below)"
                : "")
            : "") +
          (body.data?.status ? ` — HMRC status: ${body.data.status}` : ""),
      );
      onSuccess?.(body as Record<string, unknown>);
    } catch (e) {
      setHmrcMessage(`${label} error: ${e instanceof Error ? e.message : "unknown"}`);
      setHmrcMessageOk(false);
    } finally {
      setHmrcBusy(false);
    }
  }

  if (isConvexSessionMissing(isLoaded, Boolean(isSignedIn), isConvexAuthLoading, isAuthenticated)) {
    return <ConvexSessionMissing />;
  }

  if (
    declaration === undefined ||
    notifications === undefined ||
    submissions === undefined ||
    auditLogs === undefined
  ) {
    return <DeclarationPageSkeleton />;
  }

  if (!declaration) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-sm text-slate-500">Declaration not found.</p>
      </div>
    );
  }

  const isSubmitted = declaration.status !== "Draft";

  const AMEND_OPTIONS: Array<{ label: string; changeKind: string; wcoPath?: string; header?: boolean }> = [
    { label: "Item price (DE 4/14)", changeKind: "itemChargeAmount" },
    { label: "Gross mass (DE 6/5)", changeKind: "grossMass" },
    {
      label: "Nature of transaction (DE 8/5)",
      changeKind: "headerField",
      wcoPath: "Declaration/GoodsShipment/TransactionNatureCode",
      header: true,
    },
    {
      label: "Country of destination (DE 5/8)",
      changeKind: "headerField",
      wcoPath: "Declaration/GoodsShipment/Destination/CountryCode",
      header: true,
    },
  ];

  function runAmend(opt: (typeof AMEND_OPTIONS)[number]) {
    if (!declaration?.mrn) return;
    setAmendMenuOpen(false);
    let value: string | undefined;
    if (opt.header) {
      const entered = window.prompt(`New value for ${opt.label}:`, "");
      if (entered === null) return;
      value = entered.trim();
      if (!value) return;
    } else if (!confirm(`Submit ${opt.label} amendment to HMRC for this MRN?`)) {
      return;
    }
    const fraud = generateClientFraudHeaders(userId || undefined);
    runHmrcAction(
      "Amend",
      () =>
        fetch("/api/hmrc/amend", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...fraud },
          body: JSON.stringify({
            declarationId: id,
            mrn: declaration.mrn,
            changeKind: opt.changeKind,
            wcoPath: opt.wcoPath,
            value,
          }),
        }),
      (body) => {
        const convId =
          typeof body.conversationId === "string" && body.conversationId.trim()
            ? body.conversationId.trim()
            : declaration.conversationId;
        void fetch(
          `/api/hmrc/notifications/pull?declarationId=${encodeURIComponent(id)}${
            convId ? `&conversationId=${encodeURIComponent(convId)}` : ""
          }`,
          hmrcFetchInit(),
        );
      },
    );
  }

  const notificationMeta: Record<string, { title: string; color: string; icon: "success" | "warning" | "danger" | "info"; detail: string }> = {
    DMSUB:  { title: "Declaration received by HMRC (DMSUB)",  color: "bg-blue-500",  icon: "info",    detail: "Declaration has been received and queued by HMRC." },
    DMSSUB: { title: "Declaration received by HMRC (DMSSUB)", color: "bg-blue-500",  icon: "info",    detail: "Declaration has been received and queued by HMRC." },
    DMSACC: { title: "Declaration accepted (DMSACC)",          color: "bg-green-500", icon: "success", detail: "Declaration passed initial controls and is accepted." },
    DMSCLE: { title: "Clearance event (DMSCLE)",      color: "bg-blue-500",  icon: "info",    detail: "HMRC clearance event on the timeline (see label for Trade Test meaning)." },
    DMSROG: { title: "Route to examine (DMSROG)",              color: "bg-amber-500", icon: "warning", detail: "HMRC routed this declaration for examination. Action required." },
    DMSREJ: { title: "Declaration rejected (DMSREJ)",          color: "bg-red-500",   icon: "danger",  detail: "HMRC rejected the declaration. Review error codes and amend." },
    DMSINV: { title: "Declaration invalid (DMSINV)",           color: "bg-red-500",   icon: "danger",  detail: "HMRC returned field-level validation errors." },
    DMSTAX: { title: "Duty and VAT assessed by HMRC", color: "bg-amber-500", icon: "warning", detail: "HMRC has calculated duty and import VAT for this declaration." },
    DMSCTL: { title: "Documentary control (DMSCTL)",           color: "bg-amber-500", icon: "warning", detail: "Declaration under documentary control. Documents may be requested." },
    DMSRES: { title: "Response required (DMSRES)",             color: "bg-amber-500", icon: "warning", detail: "HMRC requires a response before proceeding." },
    DMSRCV: { title: "Declaration received (DMSRCV)",          color: "bg-blue-500",  icon: "info",    detail: "HMRC confirmed receipt of the declaration." },
    DMSREQ: { title: "Further information required (DMSREQ)",  color: "bg-amber-500", icon: "warning", detail: "HMRC has requested additional information." },
    DMSDOC: { title: "Document check (DMSDOC)",                color: "bg-amber-500", icon: "warning", detail: "HMRC is checking supporting documents." },
    DMSQRY: { title: "Query raised (DMSQRY)",                  color: "bg-amber-500", icon: "warning", detail: "HMRC has raised a query on this declaration." },
    DMSNOTFN: { title: "General notification (DMSNOTFN)",        color: "bg-blue-500",  icon: "info",    detail: "HMRC sent a general status notification." },
  };

  const notifContext = (notif: {
    rawPayload?: string | null;
    fieldErrors?: unknown;
    errorCodes?: string[];
    notificationType?: string | null;
  }) => ({
    rawPayload: notif.rawPayload ?? undefined,
    fieldErrors: Array.isArray(notif.fieldErrors) ? notif.fieldErrors : undefined,
    errorCodes: Array.isArray(notif.errorCodes) ? notif.errorCodes : undefined,
    notificationType: notif.notificationType ?? "",
  });

  const mrnBlockedByClearance = declarationHasImportDmscle((notifications ?? []).map(notifContext));
  const mrnBlockedByCds12015 = declarationHasAmendStateBlocked((notifications ?? []).map(notifContext));
  const mrnBlockedForAmend = mrnBlockedByClearance || mrnBlockedByCds12015;

  const canAmendOrCancel =
    Boolean(declaration.mrn) &&
    !mrnBlockedForAmend &&
    (declaration.status === "Accepted" || declaration.status === "Amended");
  const amendInFlight = declaration.status === "Amendment Processing";

  const metaForNotification = (notif: {
    rawPayload?: string;
    fieldErrors?: Array<{ field: string; code?: string; reason: string }>;
    errorCodes?: string[];
    notificationType?: string;
  }) => {
    const type = normalizeNotificationType(notif.notificationType);
    const preset = notificationMeta[type];
    if (preset) {
      return resolveTimelineNotificationMeta(notifContext(notif), {
        title: preset.title,
        detail: preset.detail,
        color: preset.color,
        icon: preset.icon,
        normalizedType: type,
      });
    }
    const display = getNotificationDisplay(notif.notificationType);
    return resolveTimelineNotificationMeta(notifContext(notif), {
      title: display.title,
      detail: display.subtitle || "HMRC sent a status update.",
      color:
        display.tone === "success"
          ? "bg-green-500"
          : display.tone === "danger"
            ? "bg-red-500"
            : display.tone === "warning"
              ? "bg-amber-500"
              : "bg-blue-500",
      icon:
        display.tone === "success"
          ? "success"
          : display.tone === "danger"
            ? "danger"
            : display.tone === "warning"
              ? "warning"
              : "info",
      normalizedType: type,
    });
  };

  const latestNotif = notifications?.[0];
  const latestCtx = latestNotif ? notifContext(latestNotif) : null;
  const latestNotificationType = normalizeNotificationType(latestNotif?.notificationType) || "DMSUB";
  const latestIsInvalidationSuccess = latestCtx ? isInvalidationAccepted(latestCtx) : false;
  const submittedAt =
    (typeof declaration.submittedAt === "number" ? declaration.submittedAt : undefined)
    ?? declaration.created
    ?? declaration._creationTime;

  const cdsBadge = resolveDeclarationCdsBadge(
    declaration.status,
    (notifications || []).map((n) => notifContext(n)),
  );

  const cdsBadgeClass: Record<CdsBadgeTone, string> = {
    success: "bg-green-100 text-green-700",
    danger: "bg-red-100 text-red-700",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-blue-100 text-blue-700",
    neutral: "bg-slate-100 text-slate-700",
  };

  const repType = normalizeRepresentationType(
    representationStatus?.representation.representationType ?? declaration?.representationType,
  );
  const repLabel = representationSummaryLabel(repType);
  const repApproverName =
    repType === "indirect" && representationStatus?.approval?.approverName
      ? String(representationStatus.approval.approverName)
      : null;

  const hmrcActionBtnClass =
    "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-normal text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Customs Status Timeline</h2>
        <p className="mt-1 text-xs text-slate-500">
          Real-time webhook notifications pushed from HMRC Customs Declarations Service.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {!isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="mb-4 h-8 w-8 text-slate-300" />
            <h3 className="text-sm font-medium text-slate-900">Awaiting Submission</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">
              The declaration must be submitted and receive an MRN before HMRC can route status webhooks.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-3 border-b border-slate-100 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={hmrcBusy}
                    className={hmrcActionBtnClass}
                    onClick={() =>
                      runHmrcAction("Pull notifications", () =>
                        fetch(
                          `/api/hmrc/notifications/pull?declarationId=${encodeURIComponent(id)}`,
                          hmrcFetchInit(),
                        ),
                      )
                    }
                  >
                    {hmrcBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    Pull notifications
                  </button>
                  {declaration.mrn && (
                    <button
                      type="button"
                      disabled={hmrcBusy}
                      className={hmrcActionBtnClass}
                      onClick={() =>
                        runHmrcAction("Status query", () =>
                          fetch(
                            `/api/hmrc/status-query?mrn=${encodeURIComponent(declaration.mrn!)}`,
                            hmrcFetchInit(),
                          ),
                        )
                      }
                    >
                      Query HMRC status
                    </button>
                  )}
                  {canAmendOrCancel && (
                    <>
                      <div className="relative">
                        <button
                          type="button"
                          disabled={hmrcBusy}
                          className={hmrcActionBtnClass}
                          onClick={() => setAmendMenuOpen((open) => !open)}
                        >
                          Amend
                          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                        {amendMenuOpen && (
                          <div className="absolute left-0 top-full z-10 mt-1 w-60 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                            {AMEND_OPTIONS.map((opt) => (
                              <button
                                key={opt.label}
                                type="button"
                                disabled={hmrcBusy}
                                className="block w-full px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-40"
                                onClick={() => runAmend(opt)}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={hmrcBusy}
                        className={`${hmrcActionBtnClass} border-red-200 text-red-700 hover:bg-red-50`}
                        onClick={() => {
                          if (!confirm("Request cancellation (invalidation) for this MRN?")) return;
                          const reason = window.prompt(
                            "Cancellation reason (blank = code 1; or exact HMRC text for codes 1–3):",
                            "",
                          );
                          if (reason === null) return;
                          const fraud = generateClientFraudHeaders(userId || undefined);
                          runHmrcAction("Cancel", () =>
                            fetch("/api/hmrc/cancel", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                ...fraud,
                              },
                              body: JSON.stringify({
                                declarationId: id,
                                mrn: declaration.mrn,
                                reason: reason.trim(),
                              }),
                            }),
                          );
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                {amendInFlight && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    Amendment processing — use <strong>Pull notifications</strong> below. Do not use the
                    Submission tab (step 3); live declarations are amended here on Status only.
                  </p>
                )}
                {mrnBlockedByClearance && (
                  <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                    <strong>DMSCLE on this MRN</strong> — HMRC treats the declaration as cleared. Amend and
                    cancel are disabled (retries return CDS12015). Submit a new declaration and amend before
                    clearance for TDR evidence.
                  </p>
                )}
                {mrnBlockedByCds12015 && !mrnBlockedByClearance && (
                  <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                    <strong>CDS12015 — this MRN cannot be amended.</strong> HMRC rejected amend because the
                    declaration is cleared or locked. Do not retry on this MRN — create a new declaration,
                    submit, then amend within a few minutes of DMSACC.
                  </p>
                )}
                {hmrcMessage && (
                  <p
                    className={`rounded-md border p-3 text-xs ${
                      hmrcMessageOk
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {hmrcMessage}
                  </p>
                )}
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  MRN
                </p>
                <div className="flex min-h-[26px] items-center">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {declaration.mrn || "— pending"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  CDS Status
                </p>
                <div className="flex min-h-[26px] items-center">
                  {declaration.mrn && String(declaration.mrn).trim().length > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium leading-none ${cdsBadgeClass[cdsBadge.tone]}`}
                    >
                      {cdsBadge.tone === "success" ? (
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                      ) : cdsBadge.tone === "danger" ? (
                        <ShieldAlert className="h-3 w-3 shrink-0" />
                      ) : cdsBadge.tone === "neutral" ? (
                        <FileText className="h-3 w-3 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 shrink-0" />
                      )}
                      {cdsBadge.label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium leading-none text-slate-700">
                      <FileText className="h-3 w-3 shrink-0" />
                      {declaration.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Representation
                </p>
                <div className="flex min-h-[26px] items-center">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-medium leading-none",
                      repType === "indirect"
                        ? "bg-violet-100 text-violet-800"
                        : repType === "direct"
                          ? "bg-slate-200 text-slate-800"
                          : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {repLabel}
                  </span>
                </div>
                {repApproverName && (
                  <p className="mt-1.5 text-[11px] text-slate-600 truncate" title={repApproverName}>
                    Approved by {repApproverName}
                  </p>
                )}
              </div>

              <div className="flex flex-col rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Last Update
                </p>
                <div className="flex min-h-[26px] items-center">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {new Date(declaration.lastUpdated || declaration._creationTime).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative pl-6">
              <div className="absolute left-[11px] top-2 h-full w-px bg-slate-200" />
              
              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {new Date(submittedAt).toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-slate-900">Declaration Submitted</p>
                    <p className="text-xs text-slate-600">Payload successfully validated and stored by HMRC Hub.</p>
                  </div>
                </div>

                {(notifications || []).map((notif: StatusTimelineNotification) => {
                  const meta = metaForNotification(notif);
                  return (
                  <div key={notif._id} className="relative">
                    <div className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white ${meta.color}`} />
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {new Date(notif.timestamp).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                         <p className="text-sm font-medium text-slate-900">
                           {meta.title}
                         </p>
                         {meta.icon === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                         {meta.icon === "danger" && <XCircle className="h-4 w-4 text-red-500" />}
                         {meta.icon === "warning" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                      </div>
                      <p className="text-xs text-slate-600">
                        {meta.detail}
                      </p>
                      {meta.showFieldErrors && Array.isArray(notif.fieldErrors) && notif.fieldErrors.length > 0 && (
                        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                          {notif.fieldErrors.map((fieldError: { field: string; code?: string; reason: string }, idx: number) => (
                            <p key={`${notif._id}-err-${idx}`} className="break-words">
                              {fieldError.field}: {fieldError.reason}{fieldError.code ? ` (${fieldError.code})` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                      {meta.showFieldErrors && (!Array.isArray(notif.fieldErrors) || notif.fieldErrors.length === 0) && Array.isArray(notif.errorCodes) && notif.errorCodes.length > 0 && (
                        <p className="text-xs text-red-700 break-words">
                          {notif.errorCodes.join(", ")}
                        </p>
                      )}
                      <details className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 cursor-pointer">
                        <summary className="font-mono text-[10px] font-semibold hover:text-slate-900">View Raw XML Payload</summary>
                        <pre className="mt-2 overflow-x-auto p-2 bg-slate-900 text-green-400 rounded font-mono text-[10px] whitespace-pre-wrap max-h-96">
                          {notif.rawPayload}
                        </pre>
                      </details>
                    </div>
                  </div>
                  );
                })}
                
                {declaration.status !== "Cleared" && (
                   <div className="relative pt-4 cursor-pointer group" onClick={() => setNextStepsOpen(true)}>
                     <div className="absolute -left-6 top-5 h-3 w-3 rounded-full border-2 border-white bg-indigo-200 group-hover:bg-indigo-400 transition-colors" />
                     <div className="flex items-center gap-2 text-indigo-500 group-hover:text-indigo-700 transition-colors">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium underline underline-offset-4 decoration-indigo-200 group-hover:decoration-indigo-400">What happens next?</span>
                     </div>
                   </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isSubmitted && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setEvidenceOpen((o) => !o)}
          >
            <div>
              <h3 className="text-sm font-medium text-slate-900">Submission evidence &amp; audit</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Immutable request XML, LRNs, and HMRC lifecycle audit rows for this declaration.
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${evidenceOpen ? "rotate-180" : ""}`}
            />
          </button>

          {evidenceOpen && (
            <div className="mt-6 space-y-8 border-t border-slate-100 pt-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                  HMRC requests sent ({submissions?.length ?? 0})
                </h4>
                {!submissions || submissions.length === 0 ? (
                  <p className="text-xs text-slate-500">No submission evidence recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((sub: {
                      _id: string;
                      operation?: string;
                      outcome?: string;
                      lrn?: string;
                      conversationId?: string;
                      hmrcStatus?: number;
                      createdAt?: number;
                      requestXml?: string;
                    }) => (
                      <div key={sub._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-white px-2 py-0.5 font-medium text-slate-800 border border-slate-200">
                            {sub.operation || "submit"}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 font-medium ${
                              sub.outcome === "accepted"
                                ? "bg-green-100 text-green-800"
                                : sub.outcome === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {sub.outcome || "unknown"}
                          </span>
                          {sub.hmrcStatus != null && (
                            <span className="text-slate-500">HTTP {sub.hmrcStatus}</span>
                          )}
                          {sub.lrn && (
                            <span className="font-mono text-slate-600">LRN {sub.lrn}</span>
                          )}
                          {sub.conversationId && (
                            <span className="font-mono text-slate-500 truncate max-w-[12rem]" title={sub.conversationId}>
                              {sub.conversationId}
                            </span>
                          )}
                          <span className="text-slate-400 ml-auto">
                            {sub.createdAt
                              ? new Date(sub.createdAt).toLocaleString("en-GB")
                              : ""}
                          </span>
                        </div>
                        {sub.requestXml && (
                          <details
                            className="mt-2"
                            open={expandedSubmissionId === sub._id}
                            onToggle={(e) => {
                              if ((e.target as HTMLDetailsElement).open) {
                                setExpandedSubmissionId(sub._id);
                              } else if (expandedSubmissionId === sub._id) {
                                setExpandedSubmissionId(null);
                              }
                            }}
                          >
                            <summary className="cursor-pointer text-[10px] font-mono font-semibold text-slate-500 hover:text-slate-900">
                              View request XML
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900 p-2 font-mono text-[10px] text-green-400 whitespace-pre-wrap">
                              {sub.requestXml}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                  Audit trail ({auditLogs?.length ?? 0})
                </h4>
                {!auditLogs || auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">No audit rows for this declaration yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {auditLogs.map((log: {
                      _id: string;
                      action?: string;
                      timestamp?: number;
                      details?: Record<string, unknown>;
                    }) => (
                      <li
                        key={log._id}
                        className="rounded border border-slate-100 bg-white px-3 py-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{log.action}</span>
                          <span className="text-slate-400">
                            {log.timestamp
                              ? new Date(log.timestamp).toLocaleString("en-GB")
                              : ""}
                          </span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="mt-1 max-h-24 overflow-auto font-mono text-[10px] text-slate-600 whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Sheet open={nextStepsOpen} onOpenChange={setNextStepsOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md w-full p-0">
          <div className="flex flex-col min-h-full">
            <SheetHeader className="px-6 sm:px-8 pt-6 pb-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <SheetTitle className="text-lg font-semibold text-slate-900">What happens next?</SheetTitle>
              <SheetDescription className="mt-1 text-xs">
                Expected events and required actions based on HMRC routing.
              </SheetDescription>
            </SheetHeader>
            <div className="p-6 sm:p-8 space-y-6">
              {latestNotificationType === "DMSACC" && (
                <>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">Your declaration has been accepted and is awaiting customs clearance. Three outcomes are possible:</p>
                    <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <h4 className="text-sm font-medium text-green-900">DMSCLE (Goods cleared)</h4>
                      </div>
                      <p className="text-xs text-green-800">No further action is needed. Goods will be released immediately.</p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <h4 className="text-sm font-medium text-amber-900">DMSROG (Route to examine)</h4>
                      </div>
                      <p className="text-xs text-amber-800">HMRC may require additional documentation or physical examination of the goods. Action will be required.</p>
                    </div>
                    <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <h4 className="text-sm font-medium text-red-900">DMSREJ (Rejected)</h4>
                      </div>
                      <p className="text-xs text-red-800">The declaration has failed customs checks and must be amended and resubmitted.</p>
                    </div>
                  </div>
                </>
              )}

              {latestNotificationType === "DMSROG" && (
                <>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">HMRC has routed this declaration for further examination.</p>
                    
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">What HMRC may request</h4>
                      <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1">
                        <li>Commercial invoices</li>
                        <li>Packing lists</li>
                        <li>Certificates of origin</li>
                        <li>Physical inspection at the port</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">How to respond</h4>
                      <p className="text-sm text-slate-700">
                        Upload requested documents directly via the <strong>Secure Upload</strong> tab in your declaration toolbar. Include your MRN in all correspondence.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Typical timeframe</h4>
                      <p className="text-sm text-slate-700">
                        Standard documentary checks (Route 1) are typically processed within <strong>2-4 hours</strong> of upload. Physical checks (Route 2) can take <strong>24-48 hours</strong>.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {latestIsInvalidationSuccess && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    HMRC accepted your <strong>cancellation (invalidation)</strong> request. The declaration is cancelled — no further import processing.
                  </p>
                  <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                    <p className="text-xs text-green-800">
                      Proof is <strong>FunctionCode 02</strong> (DMSINV) with your <strong>CX-</strong> cancel LRN, not FunctionCode 11 (DMSCLE).
                    </p>
                  </div>
                </div>
              )}

              {!latestIsInvalidationSuccess && (latestNotificationType === "DMSREJ" || latestNotificationType === "DMSINV") && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    {latestNotificationType === "DMSINV"
                      ? "The declaration failed HMRC validation."
                      : "HMRC rejected this message (declaration or cancellation)."}
                  </p>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Error codes received</h4>
                    <p className="text-sm font-mono bg-red-50 text-red-700 p-2 rounded border border-red-100">
                      {notifications?.[0]?.errorCodes?.join(", ") ||
                        notifications?.[0]?.fieldErrors?.map((e: { code?: string; reason: string }) => e.code || e.reason).join(", ") ||
                        "Unknown Error"}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Which fields to fix</h4>
                    {(notifications?.[0]?.fieldErrors?.length ?? 0) > 0 ? (
                      <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1">
                        {notifications?.[0]?.fieldErrors?.map((err: { field: string; reason: string }, idx: number) => (
                          <li key={idx}>
                            <strong>{err.field}</strong>: {err.reason}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-700">
                        Check the raw XML payload for CDS codes and pointers (e.g. 06A for cancel XML).
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Next step</h4>
                    <p className="text-sm text-slate-700">
                      {declarationHasInvalidationAccepted(
                        (notifications || []).map((n) => notifContext(n)),
                      )
                        ? "Cancellation already succeeded on another notification — ignore duplicate DMSREJ if on cancel XML."
                        : "Fix fields on Core Schema and resubmit, or fix cancel XML per evidence pack §4.2."}
                    </p>
                  </div>
                </div>
              )}

              {latestNotificationType === "DMSUB" && (
                <>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">Your payload has been submitted to the HMRC Hub.</p>
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <h4 className="text-sm font-medium text-blue-900">Awaiting Validations</h4>
                      </div>
                      <p className="text-xs text-blue-800">The Hub is performing schema validation. You will receive a DMSACC (Accepted) or DMSINV (Invalid) shortly.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
