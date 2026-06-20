export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function hasActiveSubscription(
  subscription: { status?: string | null } | null | undefined,
): boolean {
  if (!subscription?.status) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription.status).toLowerCase());
}
