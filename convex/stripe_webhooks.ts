import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { updateSubscriptionImpl } from "./subscriptions";

/** Stripe webhook events — internal only; verify signature before calling. */
export const stripeWebhookHandler = internalMutation({
  args: {
    type: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const { type, data } = args;
    const object = data?.object;
    if (!object) return;

    if (type === "checkout.session.completed") {
      const clerkId = object.metadata?.userId;
      const subscriptionId = object.subscription;
      if (clerkId && subscriptionId) {
        await updateSubscriptionImpl(ctx, {
          userId: clerkId,
          stripeCustomerId: String(object.customer ?? ""),
          stripeSubscriptionId: String(subscriptionId),
          status: "active",
          plan: object.metadata?.plan || "Starter",
          currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
      }
      return;
    }

    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const subscription = object;
      const clerkId = subscription.metadata?.userId;
      if (!clerkId) return;

      if (type === "customer.subscription.deleted") {
        await updateSubscriptionImpl(ctx, {
          userId: clerkId,
          stripeCustomerId: String(subscription.customer ?? ""),
          stripeSubscriptionId: subscription.id,
          status: "canceled",
          plan: "Starter",
          currentPeriodEnd: Date.now(),
        });
        return;
      }

      await updateSubscriptionImpl(ctx, {
        userId: clerkId,
        stripeCustomerId: String(subscription.customer ?? ""),
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        plan: subscription.metadata?.plan || "Starter",
        currentPeriodEnd: (subscription.current_period_end ?? 0) * 1000,
      });
    }
  },
});
