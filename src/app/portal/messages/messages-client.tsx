"use client";

import { useMemo, useState } from "react";
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

const FORM_TEXTAREA =
  "mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400";
const FIELD_LABEL =
  "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";

type ThreadKey =
  | { kind: "declaration"; id: Id<"declarations"> }
  | { kind: "assessment"; id: Id<"export_assessments"> };

function parseThreadValue(value: string): ThreadKey | null {
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
    if (declarations && declarations.length > 0) return `declaration:${declarations[0]!._id}`;
    if (assessments && assessments.length > 0) return `assessment:${assessments[0]!._id}`;
    return "";
  }, [initialDeclarationId, initialAssessmentId, declarations, assessments]);

  const activeValue = selected ?? defaultValue;
  const thread = parseThreadValue(activeValue);

  const messageArgs = useMemo(() => {
    if (!authReady || !thread) return "skip" as const;
    if (thread.kind === "declaration") return { declarationId: thread.id };
    return { assessmentId: thread.id };
  }, [authReady, thread]);

  const messages = useQuery(api.client_portal.getMyMessages, messageArgs);
  const sendMessage = useMutation(api.client_portal.sendMyMessage);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !thread) return;
    setSending(true);
    setError(null);
    try {
      if (thread.kind === "declaration") {
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

  const hasTargets =
    (declarations?.length ?? 0) > 0 || (assessments?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        <div>
          <h2 className="text-sm font-medium text-black">Messages</h2>
          <p className="text-[11px] text-slate-500">
            Talk to your broker about a declaration or export assessment
          </p>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <label htmlFor="portal-thread" className={FIELD_LABEL}>
            About
          </label>
          <Select
            value={activeValue || undefined}
            onValueChange={setSelected}
            disabled={!hasTargets}
          >
            <SelectTrigger id="portal-thread" className={ENTERPRISE_SELECT_TRIGGER}>
              <SelectValue
                placeholder={
                  hasTargets
                    ? "Choose a declaration or export assessment"
                    : "Nothing to message about yet"
                }
              />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
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
          isIdle={!thread}
          idleLabel="Choose a declaration or export assessment to see messages."
          emptyLabel="No messages yet on this one."
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
            disabled={!thread}
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
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !thread || body.trim().length < 1}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Send message
        </button>
      </div>
    </div>
  );
}
