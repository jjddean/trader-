"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { MessageSquare, Send, Bot, User, Sparkles, Loader2, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AiAssistantPage() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<any[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [hmrcStatus, setHmrcStatus] = useState<{ connected: boolean; eori?: string; isExpired?: boolean } | null>(null);

    const explain = useAction(api.ai.explainTradeRule);
    const getStatus = useAction(api.actions.hmrc.getHmrcStatus);
    const getAuthUrl = useAction(api.actions.hmrc.getHmrcAuthUrl);

    useEffect(() => {
        getStatus().then(setHmrcStatus);
    }, [getStatus]);

    const handleHmrcConnect = async () => {
        try {
            const url = await getAuthUrl();
            window.location.href = url;
        } catch (error) {
            console.error("HMRC Auth Error:", error);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMessage = { role: "user", text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        try {
            const res = await explain({ query: input });
            setMessages(prev => [...prev, { role: "bot", text: res.response }]);
        } catch (error) {
            console.error("AI Error:", error);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="p-8 h-[calc(100vh-64px)] flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight">Intelligence Hub</h1>
                <p className="text-sm text-muted-foreground">
                    Consultative guidance for DCTS rules and trade compliance.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
                {/* Insights Sidebar */}
                <div className="lg:col-span-1 space-y-4 hidden lg:block">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                <Sparkles className="h-3 w-3" /> Live Integration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-4 pt-0">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">HMRC Gateway</span>
                                {hmrcStatus?.connected ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#c3fae8] bg-[#e6fcf5] text-[#087f5b] font-bold text-[9px] tracking-wide">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[#20c997] animate-pulse" />
                                        CONNECTED
                                    </div>
                                ) : (
                                    <Badge variant="secondary" className="text-[8px] h-4 px-1.5 uppercase font-bold">OFFLINE</Badge>
                                )}
                            </div>

                            {hmrcStatus?.connected ? (
                                <div className="flex items-center justify-between pt-1 border-t border-primary/5">
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] text-muted-foreground uppercase opacity-70">Linked EORI</p>
                                        <p className="font-mono text-[10px] font-bold">{hmrcStatus.eori}</p>
                                    </div>
                                    <button
                                        onClick={handleHmrcConnect}
                                        className="text-[9px] text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors font-medium"
                                    >
                                        Reconnect
                                    </button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    className="w-full text-[10px] h-7 bg-[#00897b] hover:bg-[#00796b] text-white shadow-sm border-0 gap-1.5 rounded-md transition-all active:scale-[0.98] font-bold uppercase tracking-wider"
                                    onClick={handleHmrcConnect}
                                >
                                    <LinkIcon className="h-3 w-3" />
                                    Connect HMRC Portal
                                </Button>
                            )}
                            <p className="opacity-60 leading-relaxed text-[10px] italic">Linking Gateway enables DCTS logic & live tracking.</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Chat Container */}
                <Card className="lg:col-span-3 flex flex-col overflow-hidden">
                    <CardHeader className="border-b bg-muted/30 pb-3">
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle className="text-sm">TradeDNA Consultant</CardTitle>
                                <p className="text-[10px] text-muted-foreground">Online • Policy Expert</p>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-muted">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-3">
                                <Bot className="h-10 w-10" />
                                <p className="text-sm">Ask anything about UK DCTS trade policy.</p>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                    : "bg-muted rounded-tl-none"
                                    }`}>
                                    <div className="flex items-center gap-2 mb-1 opacity-70">
                                        {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                                        <span className="font-bold uppercase tracking-tighter text-[9px]">
                                            {msg.role === "user" ? "You" : "Consultant"}
                                        </span>
                                    </div>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-muted p-3 rounded-2xl rounded-tl-none">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <div className="p-4 bg-muted/30 border-t">
                        <form onSubmit={handleSend} className="flex gap-2 relative">
                            <Input
                                placeholder="Type your trade policy question..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="pr-12 text-xs h-10 rounded-xl border-muted-foreground/20 focus-visible:ring-primary/20"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="absolute right-1 top-1 h-8 w-8 rounded-lg shadow-lg"
                                disabled={!input.trim() || isTyping}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
}
