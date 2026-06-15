import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { updateSubscriptionImpl } from "./subscriptions";
import { periodEndMs, planFromSubscriptionObject } from "./lib/stripe_plan";

async function resolveClerkUserId(
  ctx: Parameters<typeof updateSubscriptionImpl>[0],
  subscription: {
    id?: string;
    customer?: string;
    metadata?: { userId?: string };
  },
): Promise<string | null> {
  const fromMeta = subscription.metadata?.userId?.trim();
  if (fromMeta) return fromMeta;

  const customerId = subscription.customer ? String(subscription.customer) : "";
  if (customerId) {
    const byCustomer = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q: { eq: (f: string, v: string) => unknown }) =>
        q.eq("stripeCustomerId", customerId),
      )
      .unique();
    if (byCustomer?.userId) return String(byCustomer.userId);
  }

  const subId = subscription.id?.trim();
  if (subId) {
    const bySub = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q: { eq: (f: string, v: string) => unknown }) =>
        q.eq("stripeSubscriptionId", subId),
      )
      .unique();
    if (bySub?.userId) return String(bySub.userId);
  }

  return null;
}

async function applySubscriptionLifecycle(
  ctx: Parameters<typeof updateSubscriptionImpl>[0],
  type: string,
  subscription: {
    id: string;
    customer?: string;
    status?: string;
    metadata?: { userId?: string; plan?: string };
    items?: { data?: Array<{ price?: { id?: string } }> };
    current_period_end?: number;
  },
) {
  const clerkId = await resolveClerkUserId(ctx, subscription);
  if (!clerkId) {
    console.warn("[stripe-webhook] No Clerk userId for subscription", subscription.id);
    return;
  }

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
    status: subscription.status ?? "active",
    plan: planFromSubscriptionObject(subscription),
    currentPeriodEnd: periodEndMs(subscription),
  });
}

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
      const clerkId = object.metadata?.userId?.trim();
      const subscriptionId = object.subscription;
      if (clerkId && subscriptionId) {
        await updateSubscriptionImpl(ctx, {
          userId: clerkId,
          stripeCustomerId: String(object.customer ?? ""),
          stripeSubscriptionId: String(subscriptionId),
          status: "active",
          plan: object.metadata?.plan?.trim() || "Starter",
          currentPeriodEnd: periodEndMs({}),
        });
      }
      return;
    }

    if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      await applySubscriptionLifecycle(ctx, type, object);
    }
  },
});
