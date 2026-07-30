"use client";

import { FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TradeComplianceStatusMeta = {
  label: string;
  badgeClassName: string;
  cardClassName: string;
  rowTintClassName: string;
  Icon: LucideIcon;
};

export function getTradeComplianceStatusMeta(status: string): TradeComplianceStatusMeta {
  if (status === "clear") {
    return {
      label: "Clear",
      badgeClassName: "rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700",
      cardClassName: "border-green-200 bg-green-50 text-green-800",
      rowTintClassName: "hover:bg-slate-50",
      Icon: ShieldCheck,
    };
  }

  if (status === "flagged") {
    return {
      label: "Flagged",
      badgeClassName: "rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700",
      cardClassName: "border-red-200 bg-red-50 text-red-800",
      rowTintClassName: "bg-red-50/40 hover:bg-red-50",
      Icon: ShieldAlert,
    };
  }

  if (status === "review_required") {
    return {
      label: "Review required",
      badgeClassName: "rounded-md bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium text-amber-700",
      cardClassName: "border-amber-200 bg-amber-50 text-amber-800",
      rowTintClassName: "bg-amber-50/40 hover:bg-amber-50",
      Icon: ShieldAlert,
    };
  }

  return {
    label: "Draft",
    badgeClassName: "rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium text-slate-700",
    cardClassName: "border-slate-200 bg-slate-50 text-slate-700",
    rowTintClassName: "hover:bg-slate-50",
    Icon: FileText,
  };
}

export function tradeComplianceRowTintClass(status: string) {
  return getTradeComplianceStatusMeta(status).rowTintClassName;
}

export function TradeComplianceStatusBadge({ status }: { status: string }) {
  const { label, badgeClassName, Icon } = getTradeComplianceStatusMeta(status);

  return (
    <Badge className={badgeClassName}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function TradeComplianceStatusCard({
  status,
  label = "Status",
}: {
  status: string;
  label?: string;
}) {
  const meta = getTradeComplianceStatusMeta(status);

  return (
    <div className={cn("rounded-lg border px-4 py-3", meta.cardClassName)}>
      <p className="text-[0.625rem] font-semibold tracking-widest uppercase opacity-70">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <meta.Icon className="h-4 w-4" />
        <p className="text-sm font-semibold">{meta.label}</p>
      </div>
    </div>
  );
}
