"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader2, MessageSquare } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatPortalCaseLabel, formatPortalFilingLabel } from "@/components/portal/portal-status";
import { PortalMessageThread } from "@/components/portal/portal-message-thread";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTERPRISE_SELECT_CONTENT,
  ENTERPRISE_SELECT_ITEM,
  ENTERPRISE_SELECT_TRIGGER,
} from "@/lib/enterprise-select-styles";
import { buildMessagePdf, downloadBlob, messagePdfFileName } from "@/lib/portal/message-pdf";

const FORM_TEXTAREA =
  "mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400";
const FIELD_LABEL =
  "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";

type ThreadKey =
  | { kind: "general" }
  | { kind: "declaration"; id: Id<"declarations"> }
  | { kind: "assessment"; id: Id<"export_assessments"> };

function parseThreadValue(value: string): ThreadKey | null {
  if (value === "general") return { kind: "general" };
  if (value.startsWith("declaration:")) {
    return { kind: "declaration", id: value.slice("declaration:".length) as Id<"declarations"> };
  }
  if (value.startsWith("assessment:")) {
    return {
      kind: "assessment",
      id: value.slice("assessment:".length) as Id<"export_assessments">,
    };
  }
  return null;
}

export default function PortalMessagesClient({
  initialDeclarationId,
  initialAssessmentId,
}: {
  initialDeclarationId?: string;
  initialAssessmentId?: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const declarations = useQuery(api.client_portal.listMyDeclarations, authReady ? {} : "skip");
  const assessments = useQuery(
    api.client_portal.listMyComplianceAssessments,
    authReady ? {} : "skip",
  );

  const [selected, setSelected] = useState<string | null>(() => {
    if (initialDeclarationId) return `declaration:${initialDeclarationId}`;
    if (initialAssessmentId) return `assessment:${initialAssessmentId}`;
    return null;
  });

  const defaultValue = useMemo(() => {
    if (initialDeclarationId) return `declaration:${initialDeclarationId}`;
    if (initialAssessmentId) return `assessment:${initialAssessmentId}`;
    return "general";
  }, [initialDeclarationId, initialAssessmentId]);

  const activeValue = selected ?? defaultValue;
  const thread = parseThreadValue(activeValue);

  const messageArgs = useMemo(() => {
    if (!authReady || !thread) return "skip" as const;
    if (thread.kind === "general") return {};
    if (thread.kind === "declaration") return { declarationId: thread.id };
    return { assessmentId: thread.id };
  }, [authReady, thread]);

  const messages = useQuery(api.client_portal.getMyMessages, messageArgs);
  const sendMessage = useMutation(api.client_portal.sendMyMessage);
  const markMessagesRead = useMutation(api.client_portal.markMyMessagesRead);
  const generateUploadUrl = useMutation(api.client_portal.generateMyUploadUrl);
  const saveDocument = useMutation(api.client_portal.saveMyDocument);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Clear the broker's unread badge once the client is actually looking at the
  // thread. Guarded so re-renders do not re-fire the mutation.
  const markedThreadRef = useRef<string | null>(null);
  const newestUnreadId =
    messages?.find((message) => message.senderRole === "broker" && message.readAt == null)?._id ??
    null;
  const hasUnreadFromBroker = newestUnreadId != null;
  // Keyed on the newest unread message, not just the thread, so a message that
  // lands while the client is reading still clears.
  const markKey = `${activeValue}:${newestUnreadId ?? ""}`;
  useEffect(() => {
    if (!authReady || !thread || !hasUnreadFromBroker) return;
    if (markedThreadRef.current === markKey) return;
    markedThreadRef.current = markKey;
    const scope =
      thread.kind === "declaration"
        ? { declarationId: thread.id }
        : thread.kind === "assessment"
          ? { assessmentId: thread.id }
          : {};
    void markMessagesRead(scope).catch(() => {
      // Retry on the next thread visit — an unread badge is not worth an error toast.
      markedThreadRef.current = null;
    });
  }, [authReady, thread, hasUnreadFromBroker, markKey, markMessagesRead]);

  const messageContext = thread?.kind === "declaration"
    ? formatPortalFilingLabel((declarations ?? []).find((item) => item._id === thread.id) ?? { _id: thread.id })
    : thread?.kind === "assessment"
      ? formatPortalCaseLabel((assessments ?? []).find((item) => item._id === thread.id) ?? { _id: thread.id })
      : "General enquiry";

  const messagePdf = (message: { senderRole: "broker" | "client"; createdAt: number; body: string }) =>
    buildMessagePdf({
      title: "Portal message",
      context: messageContext,
      entries: [{ sender: message.senderRole === "broker" ? "Broker" : "Client", createdAt: message.createdAt, body: message.body }],
    });

  const handleSaveMessage = async (message: { _id: string; senderRole: "broker" | "client"; createdAt: number; body: string }) => {
    setActionStatus(null);
    const blob = messagePdf(message);
    const fileName = messagePdfFileName(message.createdAt, "portal-message");
    const declarationId = thread?.kind === "declaration" ? thread.id : undefined;
    const uploadUrl = await generateUploadUrl(declarationId ? { declarationId } : {});
    const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: blob });
    if (!response.ok) throw new Error("Could not upload the message PDF.");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    const result = await saveDocument({
      storageId,
      ...(declarationId ? { declarationId } : {}),
      sourceMessageId: message._id as Id<"portal_messages">,
      fileName,
      category: "correspondence",
      fileType: "correspondence",
    });
    setActionStatus(result.alreadySaved ? "Already saved in Documents." : "Saved to Documents.");
  };

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !thread) return;
    setSending(true);
    setError(null);
    try {
      if (thread.kind === "general") {
        await sendMessage({ body: trimmed });
      } else if (thread.kind === "declaration") {
        await sendMessage({ body: trimmed, declarationId: thread.id });
      } else {
        await sendMessage({ body: trimmed, assessmentId: thread.id });
      }
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };


  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-black">Messages</h2>
          <p className="text-[11px] text-slate-500">
            Message your customs representative or discuss specific customs activity
          </p>
        </div>
        <button
          type="button"
          disabled={!messages?.length}
          onClick={() => {
            if (!messages?.length) return;
            downloadBlob(buildMessagePdf({
              title: "Portal conversation",
              context: messageContext,
              entries: [...messages].reverse().map((message) => ({
                sender: message.senderRole === "broker" ? "Broker" : "Client",
                createdAt: message.createdAt,
                body: message.body,
              })),
            }), `portal-conversation-${new Date().toISOString().slice(0, 10)}.pdf`);
          }}
          className="inline-flex h-8 items-center rounded-md border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Download conversation
        </button>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <label htmlFor="portal-thread" className={FIELD_LABEL}>
            About
          </label>
          <Select
            value={activeValue || undefined}
            onValueChange={setSelected}
          >
            <SelectTrigger id="portal-thread" className={ENTERPRISE_SELECT_TRIGGER}>
              <SelectValue placeholder="Choose what this is about" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
              <SelectItem value="general" className={ENTERPRISE_SELECT_ITEM}>
                General enquiry
              </SelectItem>
              {(declarations ?? []).length > 0 ? (
                <SelectGroup>
                  <SelectLabel className="px-2 py-1.5 text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                    Declarations
                  </SelectLabel>
                  {(declarations ?? []).map((d) => (
                    <SelectItem
                      key={d._id}
                      value={`declaration:${d._id}`}
                      className={ENTERPRISE_SELECT_ITEM}
                    >
                      {formatPortalFilingLabel(d)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {(assessments ?? []).length > 0 ? (
                <SelectGroup>
                  <SelectLabel className="px-2 py-1.5 text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                    Export controls
                  </SelectLabel>
                  {(assessments ?? []).map((a) => (
                    <SelectItem
                      key={a._id}
                      value={`assessment:${a._id}`}
                      className={ENTERPRISE_SELECT_ITEM}
                    >
                      {formatPortalCaseLabel(a)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </div>

        <PortalMessageThread
          messages={messages}
          viewerRole="client"
          isIdle={false}
          idleLabel=""
          emptyLabel={thread?.kind === "general" ? "No general messages yet." : "No messages yet on this one."}
          onDownloadMessage={(message) => downloadBlob(messagePdf(message), messagePdfFileName(message.createdAt, "portal-message"))}
          onSaveMessage={handleSaveMessage}
        />

        <div>
          <label htmlFor="portal-inbox-message" className={FIELD_LABEL}>
            Your message
          </label>
          <textarea
            id="portal-inbox-message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className={FORM_TEXTAREA}
            placeholder={
              thread
                ? "Ask a question or share an update…"
                : "Choose what this is about first…"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
        </div>
        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </div>
        )}
        {actionStatus && <p className="text-xs text-emerald-700">{actionStatus}</p>}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || body.trim().length < 1}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Send message
        </button>
      </div>

    </div>
  );
}
