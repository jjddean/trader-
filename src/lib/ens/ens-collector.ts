/**
 * Collects outcomes and advanced notifications from the S&S GB APIs.
 *
 * Spec: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md` §5–6
 *
 * ## The ordering that matters
 *
 * Acknowledgement is a **destructive read**. `DELETE` removes the item from
 * HMRC's unacknowledged list permanently; there is no way to re-fetch it. So
 * the only safe sequence is:
 *
 *   list → retrieve → **persist** → acknowledge
 *
 * `collectOutcomes` and `collectNotifications` therefore take a `persist`
 * callback and acknowledge only after it resolves. If persistence throws, the
 * item is left unacknowledged and will appear on the next list — which is the
 * failure mode you want.
 *
 * Acknowledging inside the same step as retrieving, or acknowledging a batch
 * after a loop, both lose data on a crash. The callback shape exists to make
 * that ordering impossible to get wrong from outside.
 *
 * There is no webhook for either queue: ENS is pull-only, unlike the CDS path.
 */

import {
  ensBaseHeaders,
  ensBaseUrl,
  ENS_PATHS,
  type EnsEnvironment,
} from "./ens-config";
import {
  parseNotification,
  parseNotificationList,
  parseOutcome,
  parseOutcomeList,
  type EnsNotificationListEntry,
  type EnsOutcomeListEntry,
  type ParsedEnsNotification,
  type ParsedEnsOutcome,
} from "./outcome-parser";

export interface EnsCollectorOptions {
  environment: EnsEnvironment;
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Safety valve so one cycle cannot loop forever on a large backlog. */
  maxItems?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ITEMS = 200;

interface HttpResult {
  status: number;
  body?: string;
  error?: string;
}

async function request(
  url: string,
  method: "GET" | "DELETE",
  opts: EnsCollectorOptions,
): Promise<HttpResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method,
      headers: ensBaseHeaders(opts.accessToken),
      signal: controller.signal,
    });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, error: err instanceof Error ? err.message : "Request failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a link HMRC gave us against the environment host.
 *
 * HMRC returns a path (`/customs/imports/outcomes/{id}`). Using it rather than
 * rebuilding the URL means a future path change does not silently break
 * collection.
 */
function resolveLink(link: string, environment: EnsEnvironment): string {
  if (/^https?:\/\//i.test(link)) return link;
  return `${ensBaseUrl(environment)}${link.startsWith("/") ? link : `/${link}`}`;
}

export interface CollectedOutcome {
  entry: EnsOutcomeListEntry;
  outcome: ParsedEnsOutcome | null;
  rawXml?: string;
  acknowledged: boolean;
  /** Set when the item was retrieved but could not be stored or acknowledged. */
  error?: string;
}

export interface CollectionReport<T> {
  items: T[];
  /** Items HMRC listed that this cycle did not finish. They stay pending. */
  skipped: number;
  transportError?: string;
}

/**
 * List, retrieve, persist and acknowledge outcomes.
 *
 * `persist` must durably store the outcome. It is awaited before the DELETE,
 * and a throw leaves the item unacknowledged for the next cycle.
 */
export async function collectOutcomes(
  opts: EnsCollectorOptions,
  persist: (outcome: ParsedEnsOutcome, entry: EnsOutcomeListEntry, rawXml: string) => Promise<void>,
): Promise<CollectionReport<CollectedOutcome>> {
  const listUrl = `${ensBaseUrl(opts.environment)}${ENS_PATHS.listOutcomes}`;
  const listed = await request(listUrl, "GET", opts);
  if (listed.error) return { items: [], skipped: 0, transportError: listed.error };
  // 404 on the list means nothing pending, which is not an error condition.
  if (listed.status === 404) return { items: [], skipped: 0 };
  if (listed.status !== 200) {
    return { items: [], skipped: 0, transportError: `List returned HTTP ${listed.status}` };
  }

  const entries = parseOutcomeList(listed.body ?? "").slice(0, opts.maxItems ?? DEFAULT_MAX_ITEMS);
  const items: CollectedOutcome[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const url = resolveLink(entry.link || ENS_PATHS.outcome(entry.correlationId), opts.environment);
    const fetched = await request(url, "GET", opts);

    // Not available yet is normal, not a failure — leave it for the next cycle.
    if (fetched.status === 404 || fetched.error || fetched.status !== 200) {
      skipped += 1;
      continue;
    }

    const outcome = parseOutcome(fetched.body ?? "");
    if (!outcome) {
      // Unrecognised body: do NOT acknowledge, or the evidence is gone.
      items.push({
        entry,
        outcome: null,
        rawXml: fetched.body,
        acknowledged: false,
        error: "Outcome body was not a recognised IE328/IE316/IE304/IE305 message",
      });
      skipped += 1;
      continue;
    }

    try {
      await persist(outcome, entry, fetched.body ?? "");
    } catch (err) {
      items.push({
        entry,
        outcome,
        rawXml: fetched.body,
        acknowledged: false,
        error: err instanceof Error ? err.message : "Persist failed",
      });
      skipped += 1;
      continue;
    }

    // Only now is it safe to remove it from HMRC's list.
    const ack = await request(url, "DELETE", opts);
    const acknowledged = ack.status === 200 || ack.status === 204;
    items.push({
      entry,
      outcome,
      rawXml: fetched.body,
      acknowledged,
      error: acknowledged ? undefined : ack.error ?? `Acknowledge returned HTTP ${ack.status}`,
    });
  }

  return { items, skipped };
}

export interface CollectedNotification {
  entry: EnsNotificationListEntry;
  notification: ParsedEnsNotification | null;
  rawXml?: string;
  acknowledged: boolean;
  error?: string;
}

/**
 * List, retrieve, persist and acknowledge advanced notifications.
 *
 * Same ordering as outcomes. Two extras:
 *
 * - A **Do Not Load** is never auto-acknowledged. It is an operational stop, and
 *   clearing it from HMRC's list before a human has seen it removes the only
 *   record that the carrier must not load. `acknowledgeDoNotLoad` defaults off.
 * - The acknowledge URL comes from HMRC's own `<acknowledgement href>` when
 *   present, rather than being rebuilt.
 */
export async function collectNotifications(
  opts: EnsCollectorOptions & { acknowledgeDoNotLoad?: boolean },
  persist: (
    notification: ParsedEnsNotification,
    entry: EnsNotificationListEntry,
    rawXml: string,
  ) => Promise<void>,
): Promise<CollectionReport<CollectedNotification>> {
  const listUrl = `${ensBaseUrl(opts.environment)}${ENS_PATHS.listNotifications}`;
  const listed = await request(listUrl, "GET", opts);
  if (listed.error) return { items: [], skipped: 0, transportError: listed.error };
  if (listed.status === 404) return { items: [], skipped: 0 };
  if (listed.status !== 200) {
    return { items: [], skipped: 0, transportError: `List returned HTTP ${listed.status}` };
  }

  const entries = parseNotificationList(listed.body ?? "").slice(
    0,
    opts.maxItems ?? DEFAULT_MAX_ITEMS,
  );
  const items: CollectedNotification[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const url = resolveLink(
      entry.link || ENS_PATHS.notification(entry.notificationId),
      opts.environment,
    );
    const fetched = await request(url, "GET", opts);
    if (fetched.status === 404 || fetched.error || fetched.status !== 200) {
      skipped += 1;
      continue;
    }

    const notification = parseNotification(fetched.body ?? "");
    if (!notification) {
      items.push({
        entry,
        notification: null,
        rawXml: fetched.body,
        acknowledged: false,
        error: "Notification body was not a recognised IE351 message",
      });
      skipped += 1;
      continue;
    }

    try {
      await persist(notification, entry, fetched.body ?? "");
    } catch (err) {
      items.push({
        entry,
        notification,
        rawXml: fetched.body,
        acknowledged: false,
        error: err instanceof Error ? err.message : "Persist failed",
      });
      skipped += 1;
      continue;
    }

    // A Do Not Load stays on HMRC's list until a human clears it.
    if (notification.doNotLoad && !opts.acknowledgeDoNotLoad) {
      items.push({ entry, notification, rawXml: fetched.body, acknowledged: false });
      continue;
    }

    const ackUrl = notification.acknowledgementHref
      ? resolveLink(notification.acknowledgementHref, opts.environment)
      : url;
    const ack = await request(ackUrl, "DELETE", opts);
    const acknowledged = ack.status === 200 || ack.status === 204;
    items.push({
      entry,
      notification,
      rawXml: fetched.body,
      acknowledged,
      error: acknowledged ? undefined : ack.error ?? `Acknowledge returned HTTP ${ack.status}`,
    });
  }

  return { items, skipped };
}
