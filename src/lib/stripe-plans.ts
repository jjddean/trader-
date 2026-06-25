export const PLAN_SLUGS = ["starter", "pro", "payg"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const PLAN_LABELS: Record<PlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  payg: "Pay As You Go",
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
    slug: "payg",
    label: PLAN_LABELS.payg,
    price: "£9.99",
    interval: "per use",
    description: "Occasional filings without a monthly commitment.",
    features: ["Pay per declaration", "Full CDS submission", "HMRC notifications"],
  },
  {
    slug: "starter",
    label: PLAN_LABELS.starter,
    price: "£99.99",
    interval: "per month",
    description: "Solo brokers and small teams getting started.",
    features: ["Unlimited draft declarations", "AI document extraction", "Team workspace"],
    highlighted: true,
  },
  {
    slug: "pro",
    label: PLAN_LABELS.pro,
    price: "£299.99",
    interval: "per month",
    description: "Higher volume customs operations.",
    features: ["Everything in Starter", "Priority support", "Advanced reporting"],
  },
];

export const CUSTOM_PLAN = {
  label: "Custom",
  description: "Volume pricing or bespoke onboarding for larger brokers.",
  cta: "Contact sales",
  href: "/contact",
};

export function planBadgeClass(plan: string): string {
  if (plan === PLAN_LABELS.pro) return "bg-blue-100 text-blue-700";
  if (plan === PLAN_LABELS.payg) return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
}
