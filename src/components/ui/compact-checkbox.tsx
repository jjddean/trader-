"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const BORDER = {
  slate: "border-slate-300",
  amber: "border-amber-300",
} as const;

export interface CompactCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  border?: keyof typeof BORDER;
}

/** Fixed 12px checkbox — native inputs ignore Tailwind h/w on many browsers. */
export function CompactCheckbox({
  className,
  border = "slate",
  checked,
  disabled,
  readOnly,
  ...props
}: CompactCheckboxProps) {
  const inactive = disabled || readOnly;

  return (
    <span className="relative inline-flex h-3 w-3 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          "peer absolute inset-0 m-0 size-3 appearance-none rounded-[2px] border bg-white",
          BORDER[border],
          "checked:border-emerald-600 checked:bg-emerald-600",
          inactive ? "cursor-default" : "cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/80 focus-visible:ring-offset-1",
          className,
        )}
        {...props}
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto size-2 text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
