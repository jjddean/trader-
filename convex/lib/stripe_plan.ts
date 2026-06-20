export const PLAN_SLUGS = ["starter", "pro", "payg"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const PLAN_LABELS: Record<PlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  payg: "Pay As You Go",
};

function envPriceId(key: "STRIPE_STARTER_PRICE_ID" | "STRIPE_PRO_PRICE_ID" | "STRIPE_PAYG_PRICE_ID") {
  return process.env[key]?.trim() || null;
}

export function priceIdForPlan(slug: PlanSlug): string | null {
  if (slug === "starter") return envPriceId("STRIPE_STARTER_PRICE_ID");
  if (slug === "pro") return envPriceId("STRIPE_PRO_PRICE_ID");
  return envPriceId("STRIPE_PAYG_PRICE_ID");
}

export function planSlugFromLabel(label: string): PlanSlug | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === "starter") return "starter";
  if (normalized === "pro" || normalized === "professional") return "pro";
  if (normalized === "pay as you go" || normalized === "payg") return "payg";
  return null;
}

/** Map Stripe price IDs (Convex env) to display plan names. */
export function planFromStripePriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  const starter = envPriceId("STRIPE_STARTER_PRICE_ID");
  const pro = envPriceId("STRIPE_PRO_PRICE_ID");
  const payg = envPriceId("STRIPE_PAYG_PRICE_ID");
  if (starter && priceId === starter) return PLAN_LABELS.starter;
  if (pro && priceId === pro) return PLAN_LABELS.pro;
  if (payg && priceId === payg) return PLAN_LABELS.payg;
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
    return fromMeta;
  }
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return planFromStripePriceId(priceId) ?? PLAN_LABELS.starter;
}

export function periodEndMs(subscription: { current_period_end?: number }): number {
  const end = subscription.current_period_end;
  if (typeof end === "number" && end > 0) return end * 1000;
  return Date.now() + 30 * 24 * 60 * 60 * 1000;
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim() ||
    "http://localhost:3000"
  );
}
