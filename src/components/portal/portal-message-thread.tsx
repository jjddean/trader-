"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface PortalThreadMessage {
  _id: string;
  senderRole: "broker" | "client";
  body: string;
  createdAt: number;
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

interface PortalMessageThreadProps {
  messages: PortalThreadMessage[] | undefined;
  viewerRole: "broker" | "client";
  emptyLabel: string;
  idleLabel?: string;
  isIdle?: boolean;
}

/** Dense filing-note chat. Scroll stays inside the pane. */
export function PortalMessageThread({
  messages,
  viewerRole,
  emptyLabel,
  idleLabel,
  isIdle = false,
}: PortalMessageThreadProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const chronological = messages
    ? [...messages].sort((a, b) => a.createdAt - b.createdAt)
    : undefined;

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !chronological?.length) return;
    pane.scrollTop = pane.scrollHeight;
  }, [chronological?.length, chronological?.[chronological.length - 1]?._id]);

  return (
    <div
      ref={paneRef}
      className="h-56 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"
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
            return (
              <div
                key={msg._id}
                className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}
              >
                <div className="flex items-baseline gap-1.5 px-0.5">
                  <span className="text-[10px] font-medium text-slate-500">{label}</span>
                  <span className="text-[10px] text-slate-400">{formatChatTime(msg.createdAt)}</span>
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug whitespace-pre-wrap",
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
