export const PLAN_SLUGS = ["starter", "business"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const PLAN_LABELS: Record<PlanSlug, string> = {
  starter: "Starter",
  business: "Business",
};

/**
 * Plans withdrawn from sale. Not offered at checkout, but still recognised so an
 * existing subscriber's plan renders as what they actually bought.
 */
const LEGACY_PLAN_LABELS = ["Pro", "Pay As You Go"] as const;

function envPriceId(key: "STRIPE_STARTER_PRICE_ID" | "STRIPE_BUSINESS_PRICE_ID") {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

export function priceIdForPlan(slug: PlanSlug): string | null {
  if (slug === "starter") return envPriceId("STRIPE_STARTER_PRICE_ID");
  return envPriceId("STRIPE_BUSINESS_PRICE_ID");
}

export function planSlugFromLabel(label: string): PlanSlug | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === "starter") return "starter";
  if (normalized === "business") return "business";
  return null;
}

/** Map Stripe price IDs (Convex env) to display plan names. */
export function planFromStripePriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  const starter = envPriceId("STRIPE_STARTER_PRICE_ID");
  const business = envPriceId("STRIPE_BUSINESS_PRICE_ID");
  if (starter && priceId === starter) return PLAN_LABELS.starter;
  if (business && priceId === business) return PLAN_LABELS.business;
  return null;
}

export function planFromSubscriptionObject(subscription: {
  metadata?: { plan?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
}): string {
  const fromMeta = subscription.metadata?.plan?.trim();
  if (fromMeta) {
    const slug = planSlugFromLabel(fromMeta);
    if (slug) return PLAN_LABELS[slug];
    // Withdrawn plans keep their own name rather than being relabelled.
    const legacy = LEGACY_PLAN_LABELS.find(
      (name) => name.toLowerCase() === fromMeta.toLowerCase(),
    );
    return legacy ?? fromMeta;
  }
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return planFromStripePriceId(priceId) ?? PLAN_LABELS.starter;
}

export function periodEndMs(subscription: { current_period_end?: number }): number {
  const end = subscription.current_period_end;
  return typeof end === "number" ? end * 1000 : 0;
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim() ||
    "http://localhost:3000"
  );
}
