import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

export const getSubscription = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
  },
});

export const updateSubscription = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    plan: v.string(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    return await updateSubscriptionImpl(ctx, args);
  },
});

export async function updateSubscriptionImpl(
  ctx: any,
  args: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    status: string;
    plan: string;
    currentPeriodEnd: number;
  },
) {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: args.status,
      plan: args.plan,
      currentPeriodEnd: args.currentPeriodEnd,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
    });
    return existing._id;
  }

  return await ctx.db.insert("subscriptions", args);
}

/** Drop a stale or synthetic Stripe customer id so checkout can create a real one. */
export const clearStripeCustomer = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!existing) return null;
    await ctx.db.patch(existing._id, { stripeCustomerId: undefined });
    return existing._id;
  },
});

/** CLI/script verification after Stripe webhook tests — internal only. */
export const getSubscriptionByUserIdInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});
