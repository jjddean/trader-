/**
 * Dashboard page shell — the ONLY layout pattern for /dashboard/* pages.
 *
 * Visual language: components/dashboard/design-tokens.ts
 * Rules for new dashboard pages:
 * - Wrap content in PageContainer
 * - Use PageSection for bordered panels (never raw `<section className="border…">`)
 * - Use StatTile for metric grids (never custom stat divs)
 * - Use semantic tokens via ds — never raw gray-* or blue-* in dashboard code
 */

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ds, priorityLevelClass, priorityLevelLabel, priorityScoreClass } from "./design-tokens";
import { cn } from "@/lib/utils";

/** Verbatim from targets-app lib/company-display-name.ts */
function labelDecision(decision: string): string {
  if (!decision) return "Skip";
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}

export { ds, priorityLevelClass, priorityLevelLabel, priorityScoreClass };

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 px-4 lg:gap-6 lg:px-6", className)}>
      {children}
    </div>
  );
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn(ds.card, "gap-0 py-0", className)}>
      {title || action ? (
        <CardHeader className="border-b border-border py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
              {description ? (
                <CardDescription>{description}</CardDescription>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn("py-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number; hint?: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={ds.metricTile}>
          <p className={ds.metricLabel}>{item.label}</p>
          <p className={ds.metricValue}>{item.value}</p>
          {item.hint ? (
            <p className="text-muted-foreground mt-1 text-[11px]">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn(ds.metricTile, "px-3 py-2", className)}>
      <p className={ds.metricLabel}>{label}</p>
      <p className="text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

export function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={ds.card}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

export function MutedPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(ds.advisoryPanel, "text-sm", className)}>
      {children}
    </div>
  );
}

export function PageLoading({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      {label ? <p className="text-muted-foreground text-sm">{label}</p> : null}
    </div>
  );
}

export function PageEmpty({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <PageContainer>
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <p className="text-muted-foreground text-sm">{message}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </PageContainer>
  );
}

export function AlertBanner({
  children,
  variant = "destructive",
}: {
  children: React.ReactNode;
  variant?: "destructive" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        variant === "destructive"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
      )}
    >
      {children}
    </div>
  );
}

export type BadgeVariant = "default" | "secondary" | "outline";

/** Freightcode-style decision colours — muted for corporate UI. */
export function decisionBadgeClass(decision: string): string {
  if (decision === "contact") {
    return "border border-green-200/80 bg-green-50 text-green-800 hover:bg-green-50 dark:border-green-900 dark:bg-green-950 dark:text-green-200";
  }
  if (decision === "watch") {
    return "border border-amber-200/80 bg-amber-50 text-amber-900 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
  }
  return "border bg-muted text-muted-foreground hover:bg-muted";
}

export function financeBadgeClass(verified: boolean): string {
  return verified
    ? "border border-emerald-200/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
    : "border bg-muted text-muted-foreground hover:bg-muted";
}

export function DecisionBadge({
  decision,
  className,
}: {
  decision: string;
  className?: string;
}) {
  return (
    <Badge className={cn("text-xs font-medium", decisionBadgeClass(decision), className)}>
      {labelDecision(decision)}
    </Badge>
  );
}

export function FinanceBadge({
  verified,
  className,
  children,
}: {
  verified: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Badge className={cn("text-[10px] font-normal", financeBadgeClass(verified), className)}>
      {children ?? (verified ? "Verified" : "Meta")}
    </Badge>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function ExternalLinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
}
