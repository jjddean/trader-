"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CUSTOM_PLAN,
  PLAN_LABELS,
  STRIPE_PLAN_CARDS,
  type PlanSlug,
} from "@/lib/stripe-plans";

export function PricingPlans() {
  const createCheckout = useAction(api.actions.stripe.createCheckoutSession);
  const [loadingSlug, setLoadingSlug] = useState<PlanSlug | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(slug: PlanSlug) {
    setLoadingSlug(slug);
    setError(null);
    try {
      const url = await createCheckout({ plan: slug });
      if (!url) {
        setError("Checkout could not be started.");
        return;
      }
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoadingSlug(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {STRIPE_PLAN_CARDS.map((plan) => (
          <div
            key={plan.slug}
            className={cn(
              "flex flex-col rounded-xl border bg-white p-5",
              plan.highlighted ? "border-slate-900 shadow-sm" : "border-slate-200",
            )}
          >
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-900">{plan.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {plan.price}
                <span className="ml-1 text-xs font-normal text-slate-500">{plan.interval}</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">{plan.description}</p>
            </div>
            <ul className="mb-5 flex-1 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className={cn("h-9 w-full text-xs", plan.highlighted ? "bg-black hover:bg-slate-800" : "")}
              variant={plan.highlighted ? "default" : "outline"}
              disabled={loadingSlug !== null}
              onClick={() => handleCheckout(plan.slug)}
            >
              {loadingSlug === plan.slug ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Choose ${plan.label}`
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-center">
        <p className="text-sm font-medium text-slate-800">{CUSTOM_PLAN.label}</p>
        <p className="mt-1 text-xs text-slate-500">{CUSTOM_PLAN.description}</p>
        <Button variant="link" className="mt-2 h-auto p-0 text-xs" asChild>
          <Link href={CUSTOM_PLAN.href}>{CUSTOM_PLAN.cta}</Link>
        </Button>
      </div>

      {error && <p className="text-center text-xs text-red-600">{error}</p>}
      <p className="text-center text-[11px] text-slate-400">
        Prices shown for display. Stripe bills your saved price IDs ({PLAN_LABELS.starter},{" "}
        {PLAN_LABELS.pro}, {PLAN_LABELS.payg}).
      </p>
    </div>
  );
}
