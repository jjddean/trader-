/* eslint-disable @typescript-eslint/no-explicit-any */
"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import Stripe from "stripe";

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Convex environment");
  return new Stripe(key, {
    apiVersion: "2024-06-20" as any,
  });
};

export const createCheckoutSession = action({
  args: {
    plan: v.string(), // "Professional" or "Enterprise"
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        metadata: {
          userId: identity.subject,
          plan: args.plan,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/dashboard/user/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/dashboard/pricing?canceled=true`,
      metadata: {
        userId: identity.subject,
        plan: args.plan,
      },
      customer_email: identity.email,
    });

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
    if (!customerId) {
      throw new Error("No Stripe customer linked to this account");
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/dashboard/settings`,
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
