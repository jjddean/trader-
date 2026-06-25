/* eslint-disable @typescript-eslint/no-explicit-any */
"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import Stripe from "stripe";
import {
  PLAN_LABELS,
  PLAN_SLUGS,
  appBaseUrl,
  priceIdForPlan,
  type PlanSlug,
} from "../lib/stripe_plan";
import { isSyntheticStripeCustomerId } from "../lib/stripe_customer";

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Convex environment");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as any,
  });
};

function readOrgId(identity: Record<string, unknown>): string {
  const orgId = identity.org_id ?? identity.orgId;
  return typeof orgId === "string" ? orgId.trim() : "";
}

export const createCheckoutSession = action({
  args: {
    plan: v.union(v.literal("starter"), v.literal("pro"), v.literal("payg")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const slug = args.plan as PlanSlug;
    if (!PLAN_SLUGS.includes(slug)) {
      throw new Error("Invalid plan");
    }

    const priceId = priceIdForPlan(slug);
    if (!priceId) {
      throw new Error(`Stripe price not configured for ${PLAN_LABELS[slug]}`);
    }

    const planLabel = PLAN_LABELS[slug];
    const orgId = readOrgId(identity as Record<string, unknown>);
    const baseUrl = appBaseUrl();

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        metadata: {
          userId: identity.subject,
          plan: planLabel,
          ...(orgId ? { orgId } : {}),
        },
      },
      success_url: `${baseUrl}/dashboard/settings?tab=subscription&success=true`,
      cancel_url: `${baseUrl}/dashboard/pricing?canceled=true`,
      metadata: {
        userId: identity.subject,
        plan: planLabel,
        ...(orgId ? { orgId } : {}),
      },
      customer_email: identity.email,
    });

    if (!session.url) throw new Error("Stripe checkout session missing URL");
    return session.url;
  },
});

export const createPortalSession = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const subscription = (await ctx.runQuery(api.subscriptions.getSubscription, {})) as {
      stripeCustomerId?: string;
    } | null;
    const customerId = subscription?.stripeCustomerId;
    if (!customerId || typeof customerId !== "string") {
      throw new Error("No billing account linked. View plans to subscribe.");
    }
    if (isSyntheticStripeCustomerId(customerId)) {
      await ctx.runMutation(api.subscriptions.clearStripeCustomer, {});
      throw new Error("Billing account was reset. View plans to subscribe.");
    }

    const stripe = getStripe();
    try {
      await stripe.customers.retrieve(customerId);
    } catch (error) {
      const stripeError = error as { code?: string };
      if (stripeError?.code === "resource_missing") {
        await ctx.runMutation(api.subscriptions.clearStripeCustomer, {});
        throw new Error("Billing account not found. View plans to subscribe again.");
      }
      throw error;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl()}/dashboard/settings?tab=subscription`,
    });

    if (!session.url) throw new Error("Stripe portal session missing URL");
    return session.url;
  },
});

export const processWebhook = internalAction({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(args.body, args.signature, webhookSecret);

    await ctx.runMutation(internal.stripe_webhooks.stripeWebhookHandler, {
      type: event.type,
      data: event.data,
    });
  },
});
