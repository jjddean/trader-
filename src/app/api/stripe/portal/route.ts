import { NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe without throwing if secret is absent during build, 
// but it will throw if actually invoked without the key.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-02-25.clover",
});

export async function POST(req: Request) {
  try {
    const { customerId } = await req.json();

    if (!customerId) {
      return new NextResponse("Customer ID is required", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
