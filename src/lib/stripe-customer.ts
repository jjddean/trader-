/** Synthetic IDs from scripts/stripe-subscription-sync-test.mjs — not real Stripe customers. */
export function isSyntheticStripeCustomerId(customerId: string): boolean {
  return /^cus_test_\d+$/.test(customerId.trim());
}
