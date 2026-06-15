/** Map Stripe price IDs (Convex env) to display plan names. */
export function planFromStripePriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  const starter = process.env.STRIPE_STARTER_PRICE_ID?.trim();
  const pro = process.env.STRIPE_PRO_PRICE_ID?.trim();
  const enterprise = process.env.STRIPE_ENTERPRISE_PRICE_ID?.trim();
  if (starter && priceId === starter) return "Starter";
  if (pro && priceId === pro) return "Professional";
  if (enterprise && priceId === enterprise) return "Enterprise";
  return null;
}

export function planFromSubscriptionObject(subscription: {
  metadata?: { plan?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
}): string {
  const fromMeta = subscription.metadata?.plan?.trim();
  if (fromMeta) return fromMeta;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return planFromStripePriceId(priceId) ?? "Starter";
}

export function periodEndMs(subscription: { current_period_end?: number }): number {
  const end = subscription.current_period_end;
  if (typeof end === "number" && end > 0) return end * 1000;
  return Date.now() + 30 * 24 * 60 * 60 * 1000;
}
