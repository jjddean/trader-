"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildFinancialEstimateDisplay,
  type FinancialEstimateInput,
} from "@/lib/financial-estimate";

interface PreClearanceEstimateProps extends FinancialEstimateInput {
  className?: string;
  compact?: boolean;
}

function formatGbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PreClearanceEstimate({
  className,
  compact = false,
  ...input
}: PreClearanceEstimateProps) {
  const duty = Number(input.dutyAmount || 0);
  const vat = Number(input.vatAmount || 0);
  const total = duty + vat;
  const hasAmounts = duty > 0 || vat > 0 || Number(input.customsValue || 0) > 0;
  const display = buildFinancialEstimateDisplay(input);

  if (!hasAmounts) {
    return (
      <div className={cn("rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500", className)}>
        Add goods items with commodity code, origin, and value to see a pre-clearance cost estimate.
      </div>
    );
  }

  const BadgeIcon =
    display.badgeTone === "confirmed"
      ? CheckCircle2
      : display.badgeTone === "warning"
        ? AlertTriangle
        : Info;

  const badgeClass =
    display.badgeTone === "confirmed"
      ? "bg-green-100 text-green-800 border-green-200"
      : display.badgeTone === "warning"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-blue-100 text-blue-800 border-blue-200";

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white", className)}>
      <div className={cn("flex items-start justify-between gap-3 border-b border-slate-100", compact ? "px-4 py-3" : "px-5 py-4")}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{display.headline}</p>
          {!compact && (
            <p className="mt-1 text-xs text-slate-500">
              Customs value {formatGbp(Number(input.customsValue || 0))}
            </p>
          )}
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", badgeClass)}>
          <BadgeIcon className="h-3 w-3" />
          {display.badge}
        </span>
      </div>

      <div className={cn("space-y-2 text-sm", compact ? "px-4 py-3" : "px-5 py-4")}>
        <div className="flex items-center justify-between text-slate-600">
          <span>{display.dutyLabel}</span>
          <span className="font-semibold tabular-nums text-slate-900">{formatGbp(duty)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>{display.vatLabel}</span>
          <span className="font-semibold tabular-nums text-slate-900">{formatGbp(vat)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
          <span>{display.totalLabel}</span>
          <span className="tabular-nums">{formatGbp(total)}</span>
        </div>
      </div>

      <div className={cn("border-t border-slate-100 bg-slate-50 text-[11px] leading-relaxed text-slate-600", compact ? "px-4 py-3" : "px-5 py-3")}>
        <p>{display.footnote}</p>
        {display.preferenceHint && (
          <p className="mt-2 text-amber-800">{display.preferenceHint}</p>
        )}
      </div>
    </div>
  );
}
