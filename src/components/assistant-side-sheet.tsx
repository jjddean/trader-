"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { api } from "../../convex/_generated/api";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Loader2,
  Package,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SUGGESTED_QUERIES = [
  { icon: ShieldCheck, text: "Review the latest declaration issues and tell me what blocks submission" },
  { icon: Package, text: "Check this declaration for missing documents or validation failures" },
  { icon: Globe, text: "Summarise recent HMRC updates and what I need to do next" },
];

export function AssistantSideSheet({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const declarationId = useMemo(() => {
    const match = pathname.match(/\/dashboard\/declarations\/([^/]+)/);
    return match ? (match[1] as any) : undefined;
  }, [pathname]);

  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const userId = user?.id || "";
  const canQueryContext = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && !!userId;

  const canSubscribeContext = canQueryContext && isOpen;
  const workspace = useQuery(
    api.assistantQueries.getAssistantWorkspace,
    canSubscribeContext ? (declarationId ? { declarationId } : {}) : "skip",
  );
  const messages = workspace?.messages ?? [];
  const events = workspace?.events ?? [];
  const conversationStatus = workspace?.conversation?.status || "idle";
  const hasConversationHistory = messages.length > 0 || events.length > 0;
  const showWelcome = !hasConversationHistory;
  const timelineItems = useMemo(() => {
    const messageItems = messages.map((message: any) => ({
      type: "message" as const,
      id: String(message._id),
      createdAt: Number(message.createdAt || 0),
      item: message,
    }));
    const eventItems = events.map((event: any) => ({
      type: "event" as const,
      id: String(event._id),
      createdAt: Number(event.createdAt || 0),
      item: event,
    }));

    return [...messageItems, ...eventItems].sort((a, b) => a.createdAt - b.createdAt);
  }, [events, messages]);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [messages, events, loading, isOpen]);

  const handleSend = async (text?: string) => {
    const query = text || input;
    if (!query.trim()) return;

    setInput("");
    setLoading(true);
    setErrorMessage(null);
    setShowSuggestions(false);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          declarationId: declarationId ?? null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || `HTTP ${res.status}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "I'm having trouble connecting right now. Please ensure you're authenticated and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const syncLabel =
    isConvexAuthLoading || (canSubscribeContext && workspace === undefined)
      ? "Syncing"
      : conversationStatus === "streaming" || conversationStatus === "thinking" || loading
        ? "Thinking"
        : declarationId
          ? "Declaration linked"
          : "Ready";

  const renderEventMeta = (eventType: string) => {
    if (eventType === "CDS_REJECTION") {
      return { icon: ShieldAlert, label: "CDS rejection", tone: "text-red-700 bg-red-50 border-red-100" };
    }
    if (eventType === "VALIDATION_FAILED") {
      return { icon: AlertCircle, label: "Validation failed", tone: "text-amber-700 bg-amber-50 border-amber-100" };
    }
    if (eventType === "DOCUMENT_UPLOADED" || eventType === "DOCUMENT_REPLACED") {
      return { icon: FileText, label: "Document updated", tone: "text-blue-700 bg-blue-50 border-blue-100" };
    }
    if (eventType === "GOODS_CLEARED" || eventType === "DECLARATION_ACCEPTED") {
      return { icon: CheckCircle2, label: "Declaration updated", tone: "text-green-700 bg-green-50 border-green-100" };
    }
    return { icon: Clock, label: eventType.replaceAll("_", " "), tone: "text-gray-700 bg-gray-50 border-gray-200" };
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col h-full right-0 bg-white border-l border-gray-200">
        <SheetHeader className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-start justify-between gap-3 pr-8">
            <SheetTitle className="text-sm font-semibold flex items-center gap-2 text-black min-w-0">
              <Bot className="h-4 w-4" />
              AI Assistant
            </SheetTitle>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gray-500">
              {syncLabel}
            </span>
          </div>
        </SheetHeader>
        
        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 bg-gray-50/30">
          {showSuggestions && showWelcome && (
            <div className="flex flex-col gap-2">
              {SUGGESTED_QUERIES.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.text}
                    onClick={() => handleSend(q.text)}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-300 shadow-sm"
                  >
                    <Icon className="mt-0.5 h-4 w-4 text-gray-400 transition-colors group-hover:text-gray-600 shrink-0" />
                    <p className="text-xs leading-relaxed text-gray-600">{q.text}</p>
                  </button>
                );
              })}
              <button
                onClick={() => setShowSuggestions(false)}
                className="self-center mt-2 w-fit rounded-full bg-gray-100 px-3 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 uppercase tracking-widest"
              >
                Hide suggestions
              </button>
            </div>
          )}

          {showWelcome && (
            <div className="flex gap-3">
              <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
                <Bot className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="max-w-[85%] rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs leading-relaxed whitespace-pre-wrap text-gray-700">
                  Hello! I'm your Freightcode AI consultant. I can help with CDS errors, tariff classification, document gaps, and operational customs workflow questions.
                </p>
              </div>
            </div>
          )}

          {timelineItems.map((entry) => {
            if (entry.type === "event") {
              const event = entry.item;
              const meta = renderEventMeta(String(event.eventType || ""));
              const Icon = meta.icon;
              return (
                <div key={`event-${entry.id}`} className="flex justify-center">
                  <div className={cn("w-full max-w-[90%] rounded-xl border px-3 py-2 shadow-sm", meta.tone)}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <p className="text-[11px] font-semibold uppercase tracking-wider">
                        {meta.label}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      {event.payload?.reason ||
                        event.payload?.notificationType ||
                        event.payload?.fileName ||
                        event.payload?.mrn ||
                        "Operational event recorded for this workspace."}
                    </p>
                  </div>
                </div>
              );
            }

            const msg = entry.item;
            return (
              <div
                key={`message-${entry.id}`}
                className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role !== "user" && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
                    <Bot className="h-4 w-4 text-indigo-600" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-4 py-3 shadow-sm",
                    msg.role === "user" ? "bg-black text-white" : "border border-gray-200 bg-white",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user" ? "text-white" : "text-gray-700",
                    )}
                  >
                    {msg.content}
                    {msg.role === "assistant" && msg.streamed && (
                      <span className="ml-1 inline-block h-3 w-[2px] animate-pulse rounded bg-current align-[-1px] opacity-60" />
                    )}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-black">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}

          {(loading || conversationStatus === "streaming" || conversationStatus === "thinking") &&
            timelineItems.length === 0 && (
            <div className="flex gap-3 w-full">
              <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
                <Bot className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          
          <div ref={scrollRef} className="h-1 shrink-0" />
        </div>

        {/* Fixed Input at bottom */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0">
          {errorMessage && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMessage}
            </div>
          )}
          <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-3 hover:border-gray-300 transition-colors focus-within:border-black focus-within:bg-white focus-within:ring-1 focus-within:ring-black">
            <textarea
              placeholder="Diagnose CDS errors, classify products, or ask HMRC rules..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="h-16 w-full resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading || conversationStatus === "streaming" || conversationStatus === "thinking"}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white transition-all hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-black"
                title="Send Message"
              >
                <Send className="h-4 w-4 -ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
