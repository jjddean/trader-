"use client";

import React, { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
    Bot,
    Send,
    User,
    ShieldCheck,
    Globe,
    Package,
    Loader2,
} from "lucide-react";
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
            content: "Hello! I'm your TradeDNA AI consultant. I can help you with DCTS eligibility, Rules of Origin, tariff classifications, and trade compliance. What would you like to know?",
            timestamp: Date.now(),
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const explainTradeRule = useAction(api.ai.explainTradeRule);

    const handleSend = async (text?: string) => {
        const query = text || input;
        if (!query.trim()) return;

        const userMsg: Message = {
            id: `u-${Date.now()}`,
            role: "user",
            content: query,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const result = await explainTradeRule({ query });
            const assistantMsg: Message = {
                id: `a-${Date.now()}`,
                role: "assistant",
                content: result.response,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (_err) {
            const errorMsg: Message = {
                id: `e-${Date.now()}`,
                role: "assistant",
                content: "I'm having trouble connecting right now. Please ensure you're authenticated and try again.",
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                            {msg.role === "assistant" && (
                                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-1">
                                    <Bot className="h-4 w-4 text-gray-500" />
                                </div>
                            )}
                            <div className={cn(
                                "max-w-[75%] rounded-xl px-4 py-3",
                                msg.role === "user"
                                    ? "bg-black text-white"
                                    : "bg-white border border-gray-200"
                            )}>
                                <p className={cn(
                                    "text-xs leading-relaxed whitespace-pre-wrap",
                                    msg.role === "user" ? "text-white" : "text-gray-700"
                                )}>
                                    {msg.content}
                                </p>
                            </div>
                            {msg.role === "user" && (
                                <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center flex-shrink-0 mt-1">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Bot className="h-4 w-4 text-gray-500" />
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                            </div>
                        </div>
                    )}

                    {/* Suggested Queries (only show at start) */}
                    {messages.length <= 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                            {SUGGESTED_QUERIES.map((q) => {
                                const Icon = q.icon;
                                return (
                                    <button
                                        key={q.text}
                                        onClick={() => handleSend(q.text)}
                                        className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left group"
                                    >
                                        <Icon className="h-4 w-4 text-gray-400 mb-2 group-hover:text-gray-600 transition-colors" />
                                        <p className="text-xs text-gray-600 leading-relaxed">{q.text}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-gray-200 bg-white shrink-0">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Ask about DCTS, tariffs, Rules of Origin..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                        className="flex-1 h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || loading}
                        className="h-9 px-4 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors disabled:opacity-40 flex items-center gap-1.5"
                    >
                        <Send className="h-3 w-3" />
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
