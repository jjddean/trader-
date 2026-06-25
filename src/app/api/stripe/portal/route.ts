import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { isSyntheticStripeCustomerId } from "@/lib/stripe-customer";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

function portalError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      return new NextResponse("Convex auth token missing", { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    const subscription = await convex.query(api.subscriptions.getSubscription, { userId });
    const customerId = subscription?.stripeCustomerId;
    if (!customerId || typeof customerId !== "string") {
      return portalError("No billing account linked. View plans to subscribe.");
    }

    if (isSyntheticStripeCustomerId(customerId)) {
      await convex.mutation(api.subscriptions.clearStripeCustomer, {});
      return portalError("Billing account was reset. View plans to subscribe.");
    }

    const stripe = getStripe();
    try {
      await stripe.customers.retrieve(customerId);
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      if (stripeError?.code === "resource_missing") {
        await convex.mutation(api.subscriptions.clearStripeCustomer, {});
        return portalError("Billing account not found. View plans to subscribe again.");
      }
      throw error;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripeSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/settings?tab=subscription`,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return portalError("Failed to open billing portal. Try again or contact support.", 500);
  }
}
