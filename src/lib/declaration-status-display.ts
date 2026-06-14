import React from "react";
import { AlertCircle, FileText, ShieldAlert, ShieldCheck } from "lucide-react";
import { resolveDeclarationCdsBadge, type CdsBadgeTone } from "@/lib/notification-context";

export const CDS_TONES: CdsBadgeTone[] = ["success", "danger", "warning", "info", "neutral"];

export function isCdsBadgeTone(value: string): value is CdsBadgeTone {
  return (CDS_TONES as string[]).includes(value);
}

export interface DeclarationBadgeSource {
  status?: string;
  cdsBadgeLabel?: string;
  cdsBadgeTone?: string;
}

export function resolveDeclarationRowBadge(
  dec: DeclarationBadgeSource,
): { label: string; tone: CdsBadgeTone } {
  const resolved =
    dec.cdsBadgeLabel && dec.cdsBadgeTone && isCdsBadgeTone(dec.cdsBadgeTone)
      ? { label: dec.cdsBadgeLabel, tone: dec.cdsBadgeTone }
      : resolveDeclarationCdsBadge(dec.status ?? "Draft", undefined);

  if (resolved.label.startsWith("Amended") || dec.status === "Amended") {
    return { label: resolved.label, tone: "info" };
  }
  return resolved;
}

/**
 * Human-readable subtitle — no DMS codes (those stay on the status badge only).
 * DMSINV: "Cancelled" when cancel accepted (green); "Action Required" when invalid (red).
 */
export function declarationHumanSubtitle(
  badgeLabel: string,
  status?: string,
  tone?: CdsBadgeTone,
): string {
  const normalized = badgeLabel.toLowerCase();

  if (badgeLabel.startsWith("Cancelled") || normalized.startsWith("cancelled")) {
    return "Cancelled";
  }

  if (
    tone === "danger" ||
    badgeLabel.startsWith("Invalid") ||
    badgeLabel.startsWith("Rejected") ||
    status === "Rejected" ||
    status === "Action Required" ||
    (status === "Invalid" && tone !== "success")
  ) {
    return "Action Required";
  }

  if (
    tone === "success" ||
    status === "Accepted" ||
    normalized.includes("dmsacc") ||
    normalized.startsWith("accepted")
  ) {
    return "Accepted by HMRC";
  }

  if (
    tone === "info" &&
    (status === "Amended" || normalized.includes("dmsres") || normalized.startsWith("amended"))
  ) {
    return "Amended";
  }

  if (normalized.includes("amend processing")) {
    return "Amended";
  }

  if (status === "Draft" || tone === "warning") {
    return "Awaiting submission";
  }

  return badgeLabel.replace(/\s*\(DMS[A-Z]+\)\s*/gi, "").trim() || badgeLabel;
}

export function rowTintClass(tone: CdsBadgeTone): string {
  if (tone === "success") return "bg-green-50/50 hover:bg-green-50";
  if (tone === "danger") return "bg-red-50/50 hover:bg-red-50";
  if (tone === "warning") return "bg-amber-50/50 hover:bg-amber-50";
  if (tone === "info") return "bg-blue-50/50 hover:bg-blue-50";
  return "hover:bg-gray-50";
}

export function mrnTitleClass(tone: CdsBadgeTone): string {
  if (tone === "success") return "text-green-900 group-hover:text-green-900";
  if (tone === "danger") return "text-red-900 group-hover:text-red-900";
  if (tone === "warning") return "text-amber-900 group-hover:text-amber-900";
  if (tone === "info") return "text-blue-900 group-hover:text-blue-900";
  return "text-black group-hover:text-black";
}

export function mrnSubtitleClass(tone: CdsBadgeTone): string {
  if (tone === "success") return "text-green-700";
  if (tone === "danger") return "text-red-700";
  if (tone === "warning") return "text-amber-700";
  if (tone === "info") return "text-blue-700";
  return "text-gray-500";
}

export function badgeToneClassName(tone: CdsBadgeTone): string {
  if (tone === "success") return "bg-green-100 text-green-700";
  if (tone === "danger") return "bg-red-100 text-red-700";
  if (tone === "warning") return "bg-amber-100 text-amber-700";
  if (tone === "neutral") return "bg-gray-100 text-gray-700";
  return "bg-blue-100 text-blue-700";
}

export function badgeIconForTone(tone: CdsBadgeTone): React.ComponentType<{ className?: string }> {
  if (tone === "success") return ShieldCheck;
  if (tone === "danger") return ShieldAlert;
  if (tone === "warning" || tone === "neutral") return FileText;
  return AlertCircle;
}

export function DeclarationStatusBadge({ tone, label }: { tone: CdsBadgeTone; label: string }) {
  const Icon = badgeIconForTone(tone);
  return React.createElement(
    "span",
    {
      className: `inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium ${badgeToneClassName(tone)}`,
    },
    React.createElement(Icon, { className: "h-3 w-3" }),
    label,
  );
}
