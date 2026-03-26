"use client";

import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function WaitlistForm({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const joinWaitlist = useMutation(api.waitlist.join);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setStatus("loading");
      await joinWaitlist({ email });
      setStatus("success");
      setEmail("");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  const buttonStyles = variant === "light" 
    ? "bg-white text-slate-900 hover:bg-slate-50" 
    : "bg-[#111827] text-white hover:bg-[#374151]";

  if (status === "success") {
    return (
      <div className={cn(
        "flex h-[42px] items-center justify-center gap-2 rounded-md border px-4 text-[14px] font-medium",
        variant === "light" ? "border-white/20 bg-white/10 text-white" : "border-green-200 bg-green-50 text-green-700"
      )}>
        <CheckCircle2 className="h-4 w-4" />
        You&apos;re on the list!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Work email
      </label>
      <input
        id={inputId}
        aria-label="Work email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your work email"
        required
        disabled={status === "loading"}
        className={cn(
          "h-[42px] w-full rounded-md border px-3 text-[14px] outline-none transition-all disabled:opacity-50",
          variant === "light" 
            ? "border-white/20 bg-white/10 text-white placeholder-white/50 focus:border-white" 
            : "border-[#e9e9e7] bg-white text-[#37352f] placeholder-[#787774] focus:border-[#111827]"
        )}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={cn(
          "flex h-[42px] shrink-0 items-center justify-center rounded-md px-4 text-[14px] font-medium transition-all disabled:opacity-50 shadow-none border-none",
          buttonStyles
        )}
      >
        {status === "loading" ? "Joining..." : "Get Access"}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </button>
      {status === "error" && (
        <span className="absolute -bottom-6 left-0 text-[12px] text-red-500">
          Something went wrong. Please try again.
        </span>
      )}
    </form>
  );
}
