"use client";

import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function WaitlistForm() {
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

  if (status === "success") {
    return (
      <div className="flex h-[42px] items-center justify-center gap-2 rounded border border-green-200 bg-green-50 px-4 text-[14px] font-medium text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        You&apos;re on the list! We&apos;ll be in touch soon.
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
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your work email"
        required
        disabled={status === "loading"}
        className="h-[42px] w-full rounded border border-[#e9e9e7] bg-white px-3 text-[14px] text-[#37352f] placeholder-[#787774] transition-colors focus:border-[#2383e2] focus:outline-none focus:ring-1 focus:ring-[#2383e2] disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="flex h-[42px] shrink-0 items-center justify-center rounded border border-transparent bg-[#2383e2] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#1d6fc0] disabled:opacity-50"
      >
        {status === "loading" ? "Joining..." : "Get Early Access"}
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
