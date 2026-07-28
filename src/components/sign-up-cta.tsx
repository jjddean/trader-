"use client";

import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SIGN_UP_REDIRECT = "/session-tasks/choose-organization";

interface SignUpCtaProps {
  variant?: "light" | "dark";
  showSignIn?: boolean;
}

export function SignUpCta({ variant = "dark", showSignIn = true }: SignUpCtaProps) {
  const primaryClass =
    variant === "light"
      ? "bg-white text-slate-900 hover:bg-slate-50"
      : "bg-[#0f172a] text-white hover:bg-[#1e293b]";

  const signInClass =
    variant === "light" ? "text-white/90 hover:text-white" : "text-slate-600 hover:text-slate-900";

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <SignUpButton
        mode="redirect"
        forceRedirectUrl={SIGN_UP_REDIRECT}
        fallbackRedirectUrl={SIGN_UP_REDIRECT}
      >
        <button
          type="button"
          className={cn(
            "flex h-[42px] min-w-[160px] items-center justify-center gap-1.5 rounded-md px-6 text-[14px] font-medium shadow-none border-none transition-all",
            primaryClass,
          )}
        >
          Start free practice
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </SignUpButton>
      {showSignIn && (
        <Link href="/sign-in" className={cn("text-[14px] font-medium", signInClass)}>
          Sign in
        </Link>
      )}
    </div>
  );
}
