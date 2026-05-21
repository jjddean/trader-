"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

interface ChatSidebarProps {
  declarationId: Id<"declarations">;
}

export default function ChatSidebar({ declarationId }: ChatSidebarProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Live stream chat history context parameters natively from Convex
  const contextData = useQuery(api.assistantQueries.getDeclarationContextForAI, {
    declarationId,
  });
  
  // 2. Bind directly to your Groq edge action router script
  const sendMessageAction = useAction(api.assistantActions.sendChatMessage);

  // Auto-scroll anchor utility loop to keep chat pinned to newest entries
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [contextData?.chatHistory, isSending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    try {
      setIsSending(true);
      const userText = inputMessage;
      setInputMessage(""); // Clear field instantly for crisp UX

      await sendMessageAction({
        declarationId,
        messageBody: userText,
      });
    } catch (err) {
      console.error("Failed to route tokens to execution loop:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleShortcutClick = (promptText: string) => {
    setInputMessage(promptText);
  };

  return (
    <div className="w-80 h-full border-l border-zinc-800 bg-zinc-950 flex flex-col text-white">
      {/* Sidebar Navigation Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950">
        <h3 className="font-semibold text-xs tracking-wide text-zinc-200 uppercase">Freightcode Consultant</h3>
        <p className="text-[11px] text-zinc-500">Live Custom Document Sync Active</p>
      </div>

      {/* Messages Feed Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {contextData?.chatHistory?.map((msg: any, idx: number) => (
          <div
            key={idx}
            className={`p-2.5 rounded-md max-w-[90%] text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600 text-white ml-auto"
                : "bg-zinc-900 text-zinc-300 mr-auto border border-zinc-800"
            }`}
          >
            {msg.body}
          </div>
        ))}
        
        {isSending && (
          <div className="bg-zinc-900 text-zinc-500 mr-auto border border-zinc-800 p-2.5 rounded-md text-xs animate-pulse">
            Applying GIR Classification logic...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Strategy Suggestion Chips Layer */}
      <div className="p-3 space-y-2 border-t border-zinc-900 bg-zinc-950">
        <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-600">Quick Audits</p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => handleShortcutClick("Why did this declaration fail?")}
            className="text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 p-2 rounded-md text-left transition border border-zinc-800"
          >
            🔍 Explain DMSREJ Failure
          </button>
          <button
            type="button"
            onClick={() => handleShortcutClick("Classify 100% cotton t-shirts from Bangladesh")}
            className="text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 p-2 rounded-md text-left transition border border-zinc-800"
          >
            🇧🇩 Bangladesh DCTS Origin Check
          </button>
        </div>
      </div>

      {/* Text Entry Submission Form Footer */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-950">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask trade assistant..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
            disabled={isSending}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-50"
            disabled={isSending}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
