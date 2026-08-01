export function portalStatusBadgeClass(status: string) {
  if (status === "Clean" || status === "Accepted") return "bg-green-100 text-green-700";
  if (status === "Action Required" || status === "Rejected") return "bg-red-100 text-red-700";
  if (status === "Submitted") return "bg-blue-100 text-blue-700";
  if (status === "Draft") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-800";
}

export function formatPortalMoney(amount: number) {
  return `£${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPortalTime(ts: number) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Local time-of-day greeting for portal home. */
export function portalDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function cleanLabelPart(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === '""' || trimmed === "''") return null;
  return trimmed;
}

/** Stable label for declaration pickers — never blank. */
export function formatPortalFilingLabel(d: {
  _id: string;
  mrn?: string | null;
  declarationType?: string | null;
  status?: string | null;
}): string {
  const mrn = cleanLabelPart(d.mrn);
  const type = cleanLabelPart(d.declarationType);
  const status = cleanLabelPart(d.status);
  const primary = mrn || type || `Filing …${String(d._id).slice(-6)}`;
  return status ? `${primary} · ${status}` : primary;
}

/** Stable label for export-control case pickers. */
export function formatPortalCaseLabel(a: {
  _id: string;
  reference?: string | null;
  status?: string | null;
}): string {
  const reference = cleanLabelPart(a.reference) || `Case …${String(a._id).slice(-6)}`;
  const status = cleanLabelPart(a.status)?.replaceAll("_", " ");
  return status ? `${reference} · ${status}` : reference;
}
