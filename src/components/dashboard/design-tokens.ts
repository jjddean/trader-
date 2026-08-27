/** Shared dashboard UI tokens — used by page-shell and target panels. */
export const ds = {
  canvas: "bg-muted/40",
  card: "rounded-lg border border-border bg-card shadow-sm",
  cardInset: "rounded-md border border-border bg-card",
  sectionLabel:
    "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
  metricTile: "rounded-lg border border-border bg-card px-4 py-3 shadow-sm",
  metricLabel: "text-xs font-medium text-muted-foreground",
  metricValue: "mt-1 text-2xl font-semibold tracking-tight",
  profileHeader:
    "relative overflow-hidden rounded-t-lg border-b border-border bg-gradient-to-br from-primary/5 via-card to-card px-6 py-5",
  collapsibleTrigger:
    "flex w-full items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider transition-colors hover:text-foreground",
  advisoryPanel: "rounded-md border border-border bg-muted/20 p-4",
} as const;

export function priorityScoreClass(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  if (score >= 30) return "text-orange-600 dark:text-orange-400";
  return "text-muted-foreground";
}

export function priorityLevelClass(decision: string): string {
  if (decision === "contact") {
    return "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  }
  if (decision === "watch") {
    return "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function priorityLevelLabel(decision: string): string {
  if (decision === "contact") return "Contact";
  if (decision === "watch") return "Watch";
  return "Skip";
}
