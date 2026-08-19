/**
 * The notification event catalogue — single source of truth for what the app can
 * notify about, how it is labelled, how loud it is, and whether a user may switch
 * it off.
 *
 * Both `notify()` and the inbox UI read from here, so a display label and a
 * preference toggle can never drift apart. Adding an event means adding it here
 * first; `notify()` takes a `NotificationEvent`, not a free string.
 *
 * See docs/notifications/IMPLEMENTATION-PLAN.md §4.
 */

export type NotificationSeverity = "critical" | "action_required" | "info";

export type NotificationCategory =
  | "declaration"
  | "validation"
  | "documents"
  | "export_controls"
  | "portal"
  | "finance"
  | "hmrc_auth"
  | "cns"
  | "billing"
  | "clients"
  | "representation"
  | "admin";

export interface CategoryDefinition {
  label: string;
  description: string;
  /** Applied when the user has no stored preference row for this category. */
  defaultInApp: boolean;
  /**
   * Locked categories ignore preferences entirely. Reserved for outcomes with
   * legal or financial consequence that a user must not be able to silence —
   * a rejected declaration or a sanctions hit is not a taste question.
   */
  locked?: boolean;
}

export const NOTIFICATION_CATEGORIES: Record<NotificationCategory, CategoryDefinition> = {
  declaration: {
    label: "Declaration status",
    description: "HMRC responses on your declarations — acceptance, clearance, rejection, queries.",
    defaultInApp: true,
    locked: true,
  },
  validation: {
    label: "Validation",
    description: "Blocking validation failures and completeness changes before submission.",
    defaultInApp: true,
  },
  documents: {
    label: "Documents",
    description: "Document requirements, uploads, and processing failures.",
    defaultInApp: true,
  },
  export_controls: {
    label: "Export controls",
    description: "Classification reviews, licence requirements, and sanctions screening.",
    defaultInApp: true,
  },
  portal: {
    label: "Client portal",
    description: "Client messages, uploads, and portal access changes.",
    defaultInApp: true,
  },
  finance: {
    label: "Duties and charges",
    description: "Duty variances and payment obligations falling due.",
    defaultInApp: true,
  },
  hmrc_auth: {
    label: "HMRC connection",
    description: "HMRC authorisation linked, disconnected, or failing to refresh.",
    defaultInApp: true,
  },
  cns: {
    label: "CNS inventory",
    description: "Inventory linking outcomes and CSP transport health.",
    defaultInApp: true,
  },
  billing: {
    label: "Billing",
    description: "Subscription changes, failed payments, and plan limits.",
    defaultInApp: true,
  },
  clients: {
    label: "Clients",
    description: "Client records created or updated.",
    defaultInApp: false,
  },
  representation: {
    label: "Representation",
    description: "Indirect representation approvals and revocations.",
    defaultInApp: false,
  },
  admin: {
    label: "Admin and imports",
    description: "Bulk imports, data exports, and reference data freshness.",
    defaultInApp: false,
  },
};

export interface EventDefinition {
  category: NotificationCategory;
  severity: NotificationSeverity;
  /** Default title. Callers may override for a more specific one. */
  title: string;
}

/**
 * Every event the app may emit. Events for categories not yet wired are declared
 * here deliberately — the catalogue is the specification, and an unwired entry
 * is a visible to-do rather than an undiscoverable gap.
 */
export const NOTIFICATION_EVENTS = {
  // --- declaration (HMRC DMS outcomes, mirrored from the evidence table) ---
  "declaration.received": { category: "declaration", severity: "info", title: "Declaration received by HMRC" },
  "declaration.accepted": { category: "declaration", severity: "info", title: "Declaration accepted" },
  "declaration.cleared": { category: "declaration", severity: "info", title: "Goods cleared" },
  "declaration.rejected": { category: "declaration", severity: "critical", title: "Declaration rejected" },
  "declaration.invalidated": { category: "declaration", severity: "critical", title: "Declaration invalidated" },
  "declaration.under_control": { category: "declaration", severity: "action_required", title: "Declaration under control" },
  "declaration.route_of_goods": { category: "declaration", severity: "action_required", title: "Routed for examination" },
  "declaration.docs_requested": { category: "declaration", severity: "action_required", title: "Documents requested by HMRC" },
  "declaration.query_raised": { category: "declaration", severity: "action_required", title: "HMRC query raised" },
  "declaration.response_required": { category: "declaration", severity: "action_required", title: "Response required by HMRC" },
  "declaration.tax_assessed": { category: "declaration", severity: "info", title: "Duty and VAT assessed" },
  "declaration.notification": { category: "declaration", severity: "info", title: "HMRC notification" },
  "declaration.amendment_accepted": { category: "declaration", severity: "info", title: "Amendment accepted" },
  "declaration.amendment_rejected": { category: "declaration", severity: "action_required", title: "Amendment rejected" },
  "declaration.cancellation_accepted": { category: "declaration", severity: "info", title: "Cancellation accepted" },
  "declaration.cancellation_rejected": { category: "declaration", severity: "action_required", title: "Cancellation rejected" },
  "declaration.mrn_assigned": { category: "declaration", severity: "info", title: "MRN assigned" },
  "declaration.stuck": { category: "declaration", severity: "action_required", title: "No HMRC response received" },

  // --- validation ---
  "validation.blocking_failure": { category: "validation", severity: "action_required", title: "Blocking validation failure" },
  "validation.cleared": { category: "validation", severity: "info", title: "Validation passed" },
  "validation.completeness_dropped": { category: "validation", severity: "info", title: "Declaration completeness fell" },

  // --- documents ---
  "documents.requirement_added": { category: "documents", severity: "info", title: "New document requirement" },
  "documents.requirements_cleared": { category: "documents", severity: "info", title: "All required documents supplied" },
  "documents.requirement_unmet": { category: "documents", severity: "action_required", title: "Required documents missing" },
  "documents.upload_failed": { category: "documents", severity: "action_required", title: "Document upload failed" },
  "documents.replaced": { category: "documents", severity: "info", title: "Document replaced" },
  "documents.expiring": { category: "documents", severity: "action_required", title: "Document expiring soon" },

  // --- export controls ---
  "export_controls.classification_reviewed": { category: "export_controls", severity: "info", title: "Classification reviewed" },
  "export_controls.sanctions_hit": { category: "export_controls", severity: "critical", title: "Sanctions screening hit" },
  "export_controls.licence_required": { category: "export_controls", severity: "action_required", title: "Export licence required" },
  "export_controls.licence_recorded": { category: "export_controls", severity: "info", title: "Export licence recorded" },
  "export_controls.expert_requested": { category: "export_controls", severity: "info", title: "Expert review requested" },
  "export_controls.consultant_review_completed": { category: "export_controls", severity: "action_required", title: "Consultant review completed" },
  "export_controls.end_user_statement_submitted": { category: "export_controls", severity: "info", title: "End-user statement submitted" },

  // --- portal ---
  "portal.invite_sent": { category: "portal", severity: "info", title: "Portal invitation sent" },
  "portal.access_enabled": { category: "portal", severity: "info", title: "Portal access enabled" },
  "portal.access_revoked": { category: "portal", severity: "info", title: "Portal access revoked" },
  "portal.message_received": { category: "portal", severity: "action_required", title: "New message" },
  "portal.document_uploaded": { category: "portal", severity: "info", title: "Client uploaded a document" },

  // --- finance ---
  "finance.variance_detected": { category: "finance", severity: "action_required", title: "Duty variance detected" },
  "finance.obligation_due": { category: "finance", severity: "action_required", title: "Payment due" },

  // --- HMRC connection ---
  "hmrc_auth.linked": { category: "hmrc_auth", severity: "info", title: "HMRC account linked" },
  "hmrc_auth.disconnected": { category: "hmrc_auth", severity: "action_required", title: "HMRC account disconnected" },
  "hmrc_auth.refresh_failed": { category: "hmrc_auth", severity: "critical", title: "HMRC authorisation expired" },

  // --- CNS ---
  "cns.inventory_rejected": { category: "cns", severity: "critical", title: "Inventory linking rejected" },
  "cns.poll_failures_exceeded": { category: "cns", severity: "critical", title: "CNS notification polling failing" },

  // --- billing ---
  "billing.subscription_updated": { category: "billing", severity: "info", title: "Subscription updated" },
  "billing.payment_failed": { category: "billing", severity: "critical", title: "Payment failed" },
  "billing.limit_reached": { category: "billing", severity: "action_required", title: "Plan limit reached" },

  // --- low-signal, default off ---
  "clients.created": { category: "clients", severity: "info", title: "Client created" },
  "clients.updated": { category: "clients", severity: "info", title: "Client updated" },
  "representation.details_updated": { category: "representation", severity: "info", title: "Representation details updated" },
  "representation.indirect_approved": { category: "representation", severity: "info", title: "Indirect representation approved" },
  "representation.approval_revoked": { category: "representation", severity: "info", title: "Representation approval revoked" },
  "admin.tre_import_completed": { category: "admin", severity: "info", title: "Import completed" },
  "admin.data_export": { category: "admin", severity: "info", title: "Data export ready" },
  "admin.sanctions_snapshot_stale": { category: "admin", severity: "action_required", title: "Sanctions data is stale" },
} as const satisfies Record<string, EventDefinition>;

export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

export function eventDefinition(event: NotificationEvent): EventDefinition {
  return NOTIFICATION_EVENTS[event];
}

/** Severity values the inbox's "Urgent" tab shows. */
export const URGENT_SEVERITIES: readonly NotificationSeverity[] = ["critical", "action_required"];

export function isUrgentSeverity(severity: string): boolean {
  return (URGENT_SEVERITIES as readonly string[]).includes(severity);
}

/**
 * Whether a category may be silenced. Locked categories skip the preference
 * lookup entirely rather than reading a row and ignoring it.
 */
export function isCategoryLocked(category: string): boolean {
  return NOTIFICATION_CATEGORIES[category as NotificationCategory]?.locked === true;
}

export function categoryDefaultInApp(category: string): boolean {
  return NOTIFICATION_CATEGORIES[category as NotificationCategory]?.defaultInApp ?? true;
}

/**
 * Legacy `notificationType` spellings seen on stored rows, from parser versions
 * that recorded a raw NameCode or FunctionCode instead of the DMS literal.
 * Mirrors src/lib/notification-labels.ts, which does the same for display.
 */
const NUMERIC_NAME_TO_DMS: Record<string, string> = {
  "4": "DMSTAX",
  "67": "DMSTAX",
};

const FUNC_PREFIX_TO_DMS: Record<string, string> = {
  FUNC_01: "DMSACC",
  FUNC_09: "DMSACC",
  FUNC_11: "DMSCLE",
  FUNC_13: "DMSTAX",
};

export function normalizeDmsType(raw: string | undefined | null): string {
  const type = String(raw ?? "").trim().toUpperCase();
  if (!type) return "UNKNOWN";
  if (type.startsWith("DMS")) return type;
  if (NUMERIC_NAME_TO_DMS[type]) return NUMERIC_NAME_TO_DMS[type];
  if (FUNC_PREFIX_TO_DMS[type]) return FUNC_PREFIX_TO_DMS[type];
  return type;
}

const DMS_TO_EVENT: Record<string, NotificationEvent> = {
  DMSSUB: "declaration.received",
  DMSUB: "declaration.received",
  DMSRCV: "declaration.received",
  DMSACC: "declaration.accepted",
  DMSCLE: "declaration.cleared",
  DMSREJ: "declaration.rejected",
  DMSINV: "declaration.invalidated",
  DMSCTL: "declaration.under_control",
  DMSROG: "declaration.route_of_goods",
  DMSDOC: "declaration.docs_requested",
  DMSREQ: "declaration.docs_requested",
  DMSQRY: "declaration.query_raised",
  DMSRES: "declaration.response_required",
  DMSTAX: "declaration.tax_assessed",
  DMSNOT: "declaration.notification",
};

/**
 * Map an HMRC notification to its inbox event. Amendment and cancellation
 * outcomes reuse the same DMS codes as ordinary ones, so the caller passes the
 * context flags already computed by `notification_dms_context` rather than this
 * function re-deriving them from the payload.
 */
export function eventForNotification(params: {
  notificationType: string | undefined | null;
  isAmendmentAccepted?: boolean;
  isAmendmentRejected?: boolean;
  isCancellationRejected?: boolean;
  isInvalidationAccepted?: boolean;
}): NotificationEvent {
  if (params.isAmendmentAccepted) return "declaration.amendment_accepted";
  if (params.isAmendmentRejected) return "declaration.amendment_rejected";
  if (params.isCancellationRejected) return "declaration.cancellation_rejected";

  const type = normalizeDmsType(params.notificationType);
  if (type === "DMSINV" && params.isInvalidationAccepted) {
    return "declaration.cancellation_accepted";
  }
  return DMS_TO_EVENT[type] ?? "declaration.notification";
}

/**
 * Title including the DMS code, so the code stays visible for support and
 * evidence work while the sentence stays readable.
 */
export function titleForNotification(event: NotificationEvent, notificationType: string | undefined | null): string {
  const base = NOTIFICATION_EVENTS[event].title;
  const type = normalizeDmsType(notificationType);
  return type.startsWith("DMS") ? `${base} (${type})` : base;
}
