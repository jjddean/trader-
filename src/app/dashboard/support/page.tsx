"use client";

import { useState } from "react";
import { Bot, Sparkles, Send, FileText, Globe, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const STARTER_PROMPTS = [
  {
    icon: <Globe className="h-4 w-4" />,
    text: "Explain DCTS origin rules for India",
  },
  {
    icon: <FileText className="h-4 w-4" />,
    text: "What does CPC 40 00 000 mean?",
  },
  {
    icon: <ShieldAlert className="h-4 w-4" />,
    text: "How do I claim returned goods relief?",
  },
];

export default function AssistantPage() {
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] max-w-[800px] flex-col px-8 py-12">
      {/* Header Info */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 border border-[#e9e9e7]">
          <Bot className="h-6 w-6 text-[#37352f]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#37352f] mb-2">Compliance Assistant</h1>
        <p className="text-sm text-[#787774]">
          Ask questions about HMRC rules, UK Global Tariff, and declaration codes.
        </p>
      </div>

      {/* Main Chat Area (Empty State) */}
      <div className="flex-1 flex flex-col items-center justify-center -mt-10">
         <div className="grid w-full max-w-[600px] grid-cols-1 gap-3 sm:grid-cols-3 mb-8">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                className="flex flex-col items-start gap-2 rounded-[4px] border border-[#e9e9e7] bg-white p-4 text-left shadow-none hover:bg-gray-50 transition-colors"
                onClick={() => setInputValue(prompt.text)}
              >
                <div className="text-[#787774]">{prompt.icon}</div>
                <span className="text-sm font-medium text-[#37352f]">
                  {prompt.text}
                </span>
              </button>
            ))}
          </div>
      </div>

      {/* Input Area */}
      <div className="mt-auto relative w-full rounded-[4px] border border-[#e9e9e7] bg-white shadow-sm p-1 focus-within:border-[#2383e2] focus-within:ring-1 focus-within:ring-[#2383e2] transition-all flex items-end">
         <div className="p-2 text-[#787774]">
           <Sparkles className="h-5 w-5" />
         </div>
         <textarea
            placeholder="Ask anything about customs compliance..."
            className="w-full resize-none bg-transparent py-3 text-sm text-[#37352f] placeholder:text-[#787774] outline-none min-h-[44px] max-h-[200px]"
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Button 
            size="icon" 
            className="mb-1 mr-1 h-8 w-8 rounded-[4px] bg-[#2383e2] hover:bg-[#1d6fc0] text-white shadow-none"
            disabled={!inputValue.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
      </div>
      <div className="mt-4 text-center">
         <p className="text-xs text-[#787774]">
           AI can make mistakes. Always verify rules in the official UK Trade Tariff.
         </p>
      </div>
    </div>
  );
}
