/* eslint-disable @typescript-eslint/no-explicit-any */
"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
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
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: args.customerId,
      return_url: `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/dashboard/user/billing`,
    });

    return session.url;
  },
});
