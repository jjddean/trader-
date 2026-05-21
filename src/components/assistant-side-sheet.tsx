"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Bot, Send, User, ShieldCheck, Globe, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const SUGGESTED_QUERIES = [
  { icon: ShieldCheck, text: "Why did I receive error code CDS40045?" },
  { icon: Package, text: "Classify 100% cotton t-shirts from Bangladesh" },
  { icon: Globe, text: "Explain the CDS Rules of Origin for textiles" },
];

export function AssistantSideSheet({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your Freightcode AI consultant. I can help you with DCTS eligibility, Rules of Origin, tariff classifications, and trade compliance. What would you like to know?",
      timestamp: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const userId = user?.id || "";
  const canQueryContext = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && !!userId;

  // Pre-fetch context arrays for the LLM
  const canSubscribeContext = canQueryContext && isOpen;
  const declarationsInfo = useQuery(api.declarations.getDeclarationPreviews, canSubscribeContext ? {} : "skip");
  const documentsInfo = useQuery(api.documents.getDocuments, canSubscribeContext ? { userId } : "skip");
  const notificationsInfo = useQuery(api.notifications.getUserNotifications, canSubscribeContext ? { userId } : "skip");

  const explainTradeRule = useAction(api.ai.explainTradeRule);
  const askViaCloudAgent = async (query: string) => {
    const endpoints = [
      "wss://7330-62-31-164-236.ngrok-free.app/agents/orchestrator/global", 
      "ws://localhost:8787/agents/orchestrator/global",
      "ws://localhost:8788/agents/orchestrator/global",
    ];
    const askOnEndpoint = (wsUrl: string) =>
      new Promise<string>((resolve, reject) => {
        const id = generateId("rpc");
        let settled = false;
        let socket: WebSocket | null = null;

        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          try {
            socket?.close();
          } catch {}
          fn();
        };

        const timer = setTimeout(() => {
          finish(() => reject(new Error("Agent websocket timeout")));
        }, 12000);

        try {
          socket = new WebSocket(wsUrl);
        } catch {
          clearTimeout(timer);
          reject(new Error("Agent websocket init failed"));
          return;
        }

        socket.onopen = () => {
          socket?.send(
            JSON.stringify({
              type: "rpc",
              id,
              method: "ask",
              args: [query],
            })
          );
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
            if (msg?.type !== "rpc" || msg?.id !== id) return;
            clearTimeout(timer);
            if (msg.success) {
              const resultText = String(msg.result ?? "");
              if (resultText.includes("Binding AI needs to be run remotely")) {
                finish(() => reject(new Error(resultText)));
                return;
              }
              finish(() => resolve(resultText));
              return;
            }
            finish(() => reject(new Error(String(msg.error || "Agent RPC failed"))));
          } catch {}
        };

        socket.onerror = () => {
          clearTimeout(timer);
          finish(() => reject(new Error("Agent websocket error")));
        };

        socket.onclose = () => {
          if (settled) return;
          clearTimeout(timer);
          finish(() => reject(new Error("Agent websocket closed")));
        };
      });

    let lastError: unknown = null;
    for (const endpoint of endpoints) {
      try {
        return await askOnEndpoint(endpoint);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("No websocket endpoint available");
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, loading, isOpen]);

  const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const handleSend = async (text?: string) => {
    const query = text || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: generateId("u"),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build dynamic system context footprint
      const openDecls = (declarationsInfo || [])
        .filter((r: any) => r.status && r.status !== "Cleared" && r.status !== "Accepted" && r.status !== "Draft" && r.mrn)
        .slice(0, 20)
        .map((r: any) => ({ mrn: r.mrn, status: r.status }));
      const recentDocs = (documentsInfo || [])
        .slice(0, 5)
        .map((d: any) => ({ name: d.fileName, status: d.status || d.auditStatus }));
      const recentNotifs = (notificationsInfo || [])
        .slice(0, 5)
        .map((n: any) => ({ type: n.notificationType, time: new Date(n.timestamp).toLocaleString() }));

      const systemPrompt = `You are a UK customs declaration assistant for FreightCode. The user has the following open declarations: ${JSON.stringify(openDecls)}. Recent documents: ${JSON.stringify(recentDocs)}. Recent notifications: ${JSON.stringify(recentNotifs)}.`;
      
      const payloadQuery = `[SYSTEM INSTRUCTION]\n${systemPrompt}\n\n[USER QUERY]\n${query}`;

      let assistantText = "";
      try {
        assistantText = await askViaCloudAgent(payloadQuery);
      } catch {
        const result = await explainTradeRule({ query: payloadQuery });
        assistantText = result.response;
      }
      const assistantMsg: Message = {
        id: generateId("a"),
        role: "assistant",
        content: assistantText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (_err) {
      const errorMsg: Message = {
        id: generateId("e"),
        role: "assistant",
        content:
          "I'm having trouble connecting right now. Please ensure you're authenticated and try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col h-full right-0 bg-white border-l border-gray-200">
        <SheetHeader className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2 text-black">
            <Bot className="h-4 w-4" />
            AI Assistant
          </SheetTitle>
        </SheetHeader>
        
        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 bg-gray-50/30">
          {showSuggestions && (
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

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
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
                </p>
              </div>
              {msg.role === "user" && (
                <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-black">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {loading && (
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
                disabled={!input.trim() || loading}
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
