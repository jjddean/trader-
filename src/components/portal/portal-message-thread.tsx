"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PortalThreadMessage {
  _id: string;
  senderRole: "broker" | "client";
  body: string;
  createdAt: number;
  readAt?: number | null;
}

function formatChatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

async function copyTextExactly(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through for browsers/sessions that deny the async Clipboard API.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}

interface PortalMessageThreadProps {
  messages: PortalThreadMessage[] | undefined;
  viewerRole: "broker" | "client";
  emptyLabel: string;
  idleLabel?: string;
  isIdle?: boolean;
  onDownloadMessage?: (message: PortalThreadMessage) => void;
  onSaveMessage?: (message: PortalThreadMessage) => Promise<void>;
}

/** Dense filing-note chat. Scroll stays inside the pane. */
export function PortalMessageThread({
  messages,
  viewerRole,
  emptyLabel,
  idleLabel,
  isIdle = false,
  onDownloadMessage,
  onSaveMessage,
}: PortalMessageThreadProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const chronological = messages
    ? [...messages].sort((a, b) => a.createdAt - b.createdAt)
    : undefined;
  const lastMessageId = chronological?.at(-1)?._id;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveErrorId, setSaveErrorId] = useState<string | null>(null);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !chronological?.length) return;
    pane.scrollTop = pane.scrollHeight;
  }, [chronological?.length, lastMessageId]);

  return (
    <div
      ref={paneRef}
      className="h-40 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"
    >
      {isIdle ? (
        <p className="text-xs text-slate-500">{idleLabel}</p>
      ) : chronological === undefined ? null : chronological.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {chronological.map((msg) => {
            const isMine = msg.senderRole === viewerRole;
            const label = isMine ? "You" : viewerRole === "client" ? "Broker" : "Client";
            const copyMessage = async () => {
              setCopyErrorId(null);
              try {
                await copyTextExactly(msg.body);
                setCopiedId(msg._id);
                window.setTimeout(() => setCopiedId((current) => current === msg._id ? null : current), 1500);
              } catch {
                setCopiedId(null);
                setCopyErrorId(msg._id);
              }
            };
            return (
              <div
                key={msg._id}
                className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}
              >
                <div className="flex flex-wrap items-center gap-1.5 px-0.5">
                  <span className="text-[10px] font-medium text-slate-500">{label}</span>
                  <span className="text-[10px] text-slate-400">{formatChatTime(msg.createdAt)}</span>
                  {isMine && msg.readAt && <span className="text-[10px] text-slate-400">Read</span>}
                  <button type="button" onClick={() => void copyMessage()} className="ml-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-900">
                    {copiedId === msg._id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedId === msg._id ? "Copied" : copyErrorId === msg._id ? "Copy failed" : "Copy message"}
                  </button>
                  {onDownloadMessage && (
                    <button type="button" onClick={() => onDownloadMessage(msg)} className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-900">
                      <Download className="h-3 w-3" /> PDF
                    </button>
                  )}
                  {onSaveMessage && (
                    <button
                      type="button"
                      disabled={savingId === msg._id}
                      onClick={() => {
                        setSavingId(msg._id);
                        setSaveErrorId(null);
                        void onSaveMessage(msg)
                          .catch(() => setSaveErrorId(msg._id))
                          .finally(() => setSavingId(null));
                      }}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-900 disabled:opacity-50"
                    >
                      <FileDown className="h-3 w-3" /> {savingId === msg._id ? "Saving…" : saveErrorId === msg._id ? "Save failed" : "Save to Documents"}
                    </button>
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                    isMine
                      ? "rounded-br-md bg-slate-900 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800",
                  )}
                >
                  {msg.body}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
