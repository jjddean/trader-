"use client";

import { cn } from "@/lib/utils";

/** Clerk-like auth card chrome — centred slate page, white card. */
export function OnboardingShell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div
        className={cn(
          "w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
          wide ? "max-w-lg" : "max-w-[25rem]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export const ONBOARD_LABEL = "mb-1.5 block text-[13px] font-medium text-slate-700";
export const ONBOARD_INPUT =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";
export const ONBOARD_SECTION =
  "text-[11px] font-semibold tracking-wide text-slate-500 uppercase";
