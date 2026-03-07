import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { updateSubscriptionImpl } from "./subscriptions";

// Internal mutation used by the webhook action
export const stripeWebhookHandler = mutation({
    args: {
        type: v.string(),
        data: v.any(),
    },
    handler: async (ctx, args) => {
        const { type, data } = args;

        if (type === "checkout.session.completed" || type === "customer.subscription.updated") {
            const subscription = data.object;
            const clerkId = subscription.metadata.userId; // Important: pass this in checkout session

            if (clerkId) {
                await updateSubscriptionImpl(ctx, {
                    userId: clerkId,
                    stripeCustomerId: subscription.customer,
                    stripeSubscriptionId: subscription.id,
                    status: subscription.status,
                    plan: subscription.metadata.plan || "Starter",
                    currentPeriodEnd: subscription.current_period_end * 1000,
                });
            }
        }

        if (type === "customer.subscription.deleted") {
            const subscription = data.object;
            const clerkId = subscription.metadata.userId;

            if (clerkId) {
                await updateSubscriptionImpl(ctx, {
                    userId: clerkId,
                    stripeCustomerId: subscription.customer,
                    stripeSubscriptionId: subscription.id,
                    status: "canceled",
                    plan: "Starter", // Revert to free/starter
                    currentPeriodEnd: Date.now(),
                });
            }
        }
    },
});
