export const PLAN_SLUGS = ["starter", "business"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const PLAN_LABELS: Record<PlanSlug, string> = {
  starter: "Starter",
  business: "Business",
};

export interface StripePlanCard {
  slug: PlanSlug;
  label: string;
  price: string;
  interval: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

/** Display copy only — Stripe charges the configured price IDs. */
export const STRIPE_PLAN_CARDS: StripePlanCard[] = [
  {
    slug: "starter",
    label: PLAN_LABELS.starter,
    price: "£149",
    interval: "per month",
    description: "Solo brokers and small teams.",
    features: [
      "Unlimited draft declarations",
      "CDS submission and HMRC notifications",
      "AI document extraction",
      "Team workspace",
    ],
    highlighted: true,
  },
  {
    slug: "business",
    label: PLAN_LABELS.business,
    price: "£349",
    interval: "per month",
    description: "Higher volume customs operations.",
    features: [
      "Everything in Starter",
      "Inventory-linked clearance",
      "Advanced reporting",
      "Priority support",
    ],
  },
];

export const CUSTOM_PLAN = {
  label: "Custom",
  price: "Let's talk",
  interval: "",
  description: "Volume pricing or bespoke onboarding for larger brokers.",
  features: ["Negotiated per-declaration rates", "Onboarding support", "Custom integrations"],
  cta: "Contact sales",
  href: "/contact",
};

export function planBadgeClass(plan: string): string {
  if (plan === PLAN_LABELS.business) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}
