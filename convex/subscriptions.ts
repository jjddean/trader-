import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// This will be expanded in Stage 1/5 as we finalize the Stripe webhooks
export const getSubscription = query({
    args: { userId: v.string() }, // clerkId
    handler: async (ctx, args) => {
        return await ctx.db
            .query("subscriptions")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .unique();
    },
});

export const updateSubscription = mutation({
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

export async function updateSubscriptionImpl(ctx: any, args: {
    userId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    status: string,
    plan: string,
    currentPeriodEnd: number,
}) {
    const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
        .unique();

    if (existing) {
        await ctx.db.patch(existing._id, {
            status: args.status,
            plan: args.plan,
            currentPeriodEnd: args.currentPeriodEnd,
        });
        return existing._id;
    }

    return await ctx.db.insert("subscriptions", args);
}
