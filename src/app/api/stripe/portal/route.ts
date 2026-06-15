import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
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
    if (!customerId) {
      return new NextResponse("No Stripe customer linked to this account", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripe();
    const stripeSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/settings`,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return new NextResponse("Failed to create Stripe portal session", { status: 500 });
  }
}
