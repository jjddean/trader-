"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Bot, Send, User, ShieldCheck, Globe, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const SUGGESTED_QUERIES = [
  { icon: ShieldCheck, text: "What DCTS tier does Bangladesh fall under?" },
  { icon: Globe, text: "Explain Rules of Origin for Vietnam textiles" },
  { icon: Package, text: "What duty rate applies to HS 6109 from Cambodia?" },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your TradeDNA AI consultant. I can help you with DCTS eligibility, Rules of Origin, tariff classifications, and trade compliance. What would you like to know?",
      timestamp: 0, // Fixed to prevent hydration mismatch
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const explainTradeRule = useAction(api.ai.explainTradeRule);
  const askViaCloudAgent = async (query: string) => {
    const endpoints = [
      "wss://7330-62-31-164-236.ngrok-free.app/agents/orchestrator/global", // Prefer public tunnel
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
            }),
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

  // Auto-scroll when messages update
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      let assistantText = "";
      try {
        assistantText = await askViaCloudAgent(query);
      } catch {
        const result = await explainTradeRule({ query });
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
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Suggestions first */}
          {showSuggestions && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {SUGGESTED_QUERIES.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.text}
                    onClick={() => handleSend(q.text)}
                    className="group rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-300"
                  >
                    <Icon className="mb-2 h-4 w-4 text-gray-400 transition-colors group-hover:text-gray-600" />
                    <p className="text-xs leading-relaxed text-gray-600">{q.text}</p>
                  </button>
                );
              })}
              <button
                onClick={() => setShowSuggestions(false)}
                className="rounded-lg border border-gray-200 bg-white p-3 text-left text-xs text-gray-500 transition-colors hover:border-gray-300"
                title="Hide suggestions"
              >
                Hide suggestions
              </button>
            </div>
          )}

          {/* Input positioned just above messages, styled like a bubble */}
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <input
              type="text"
              placeholder="Ask about DCTS, tariffs, Rules of Origin..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="h-10 flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="flex h-9 items-center gap-1.5 rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              <Send className="h-3 w-3" />
              Send
            </button>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Bot className="h-4 w-4 text-gray-500" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-xl px-4 py-3",
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
            <div className="flex gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <Bot className="h-4 w-4 text-gray-500" />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>
    </div>
  );
}
