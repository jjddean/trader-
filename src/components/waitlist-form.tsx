"use client";

import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function WaitlistForm({ variant = "dark" }: { variant?: "light" | "dark" | "card" }) {
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

  const buttonStyles =
    variant === "light" || variant === "card"
      ? "bg-white text-slate-900 hover:bg-slate-100"
      : "bg-[#111827] text-white hover:bg-[#374151]";

  if (status === "success") {
    return (
      <div
        className={cn(
          "flex h-[42px] items-center justify-center gap-2 rounded-md border px-4 text-[14px] font-medium",
          variant === "card"
            ? "border-green-500/30 bg-green-500/10 text-green-300"
            : variant === "light"
              ? "border-white/20 bg-white/10 text-white"
              : "border-green-200 bg-green-50 text-green-700",
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        You&apos;re on the list!
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "relative flex w-full items-center gap-2",
        variant === "card" ? "flex-col sm:flex-row" : "max-w-sm",
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        Work email
      </label>
      <input
        id={inputId}
        aria-label="Work email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={variant === "card" ? "you@company.com" : "Enter your work email"}
        required
        disabled={status === "loading"}
        className={cn(
          "h-[42px] w-full rounded-md border px-3 text-[14px] outline-none transition-all disabled:opacity-50",
          variant === "card"
            ? "min-w-0 flex-1 border-slate-600 bg-slate-800 py-2.5 text-[15px] text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
            : variant === "light"
              ? "border-white/20 bg-white/10 text-white placeholder-white/50 focus:border-white"
              : "border-[#e9e9e7] bg-white text-[#37352f] placeholder-[#787774] focus:border-[#111827]",
        )}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={cn(
          "flex h-[42px] shrink-0 items-center justify-center rounded-md px-4 text-[14px] font-medium transition-all disabled:opacity-50 shadow-none border-none",
          variant === "card" && "px-5 py-2.5 text-[13px] font-semibold",
          buttonStyles,
        )}
      >
        {status === "loading" ? "Signing up..." : variant === "card" ? "Sign up" : "Get Access"}
        {variant !== "card" ? <ArrowRight className="ml-1.5 h-3.5 w-3.5" /> : null}
      </button>
      {status === "error" && (
        <span
          className={cn(
            "absolute -bottom-6 left-0 text-[12px]",
            variant === "card" ? "text-red-400" : "text-red-500",
          )}
        >
          Something went wrong. Please try again.
        </span>
      )}
    </form>
  );
}
