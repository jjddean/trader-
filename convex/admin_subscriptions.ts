import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const ADMIN_ROLE = "admin";

/**
 * List all admin subscriptions.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("admin_subscriptions").order("desc").take(200);
  },
});

/**
 * Upsert a subscription record.
 */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("admin_subscriptions")),
    service: v.string(),
    plan: v.string(),
    status: v.string(),
    statusOverride: v.optional(v.string()),
    loginUrl: v.string(),
    nextRenewal: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== ADMIN_ROLE) {
      throw new Error("Unauthorized: Admin access required");
    }

    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, { ...data, lastChecked: Date.now() });
      return id;
    } else {
      return await ctx.db.insert("admin_subscriptions", {
        ...data,
        lastChecked: Date.now(),
      });
    }
  },
});

/**
 * Remove a subscription record.
 */
export const remove = mutation({
  args: { id: v.id("admin_subscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== ADMIN_ROLE) {
      throw new Error("Unauthorized: Admin access required");
    }
    await ctx.db.delete(args.id);
  },
});

/**
 * Set a manual status override.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("admin_subscriptions"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== ADMIN_ROLE) {
      throw new Error("Unauthorized: Admin access required");
    }
    await ctx.db.patch(args.id, { status: args.status, lastChecked: Date.now() });
  },
});

/**
 * Seed initial subscriptions from identified services.
 */
export const seedSubscriptions = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.role !== ADMIN_ROLE) {
      throw new Error("Unauthorized: Admin access required");
    }

    const existing = await ctx.db.query("admin_subscriptions").take(1);
    if (existing.length > 0) return "Already seeded";

    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const initialServices = [
      { service: "Hugging Face", plan: "Pro / AutoTrain", status: "active", loginUrl: "https://huggingface.co/settings/tokens", nextRenewal: now + thirtyDays, notes: "Used for LoRA fine-tuning" },
      { service: "Mapbox", plan: "PAYG", status: "active", loginUrl: "https://account.mapbox.com/", nextRenewal: now + thirtyDays, notes: "Maps & Geocoding" },
      { service: "Convex", plan: "Pro", status: "active", loginUrl: "https://dashboard.convex.dev/", nextRenewal: now + thirtyDays, notes: "Backend DB" },
      { service: "Clerk", plan: "Starter", status: "active", loginUrl: "https://dashboard.clerk.com/", nextRenewal: now + thirtyDays, notes: "Auth" },
      { service: "Resend", plan: "Free", status: "active", loginUrl: "https://resend.com/overview", nextRenewal: now + thirtyDays, notes: "Email delivery" },
      { service: "Stripe", plan: "Live", status: "active", loginUrl: "https://dashboard.stripe.com/", nextRenewal: now + thirtyDays, notes: "Payments" },
      { service: "AWS", plan: "PAYG", status: "active", loginUrl: "https://console.aws.amazon.com/", nextRenewal: now + thirtyDays, notes: "S3 / Textract" },
      { service: "HMRC Dev Hub", plan: "Sandbox", status: "active", loginUrl: "https://developer.service.hmrc.gov.uk/", nextRenewal: now + thirtyDays, notes: "Customs Integration" },
      { service: "OpenAI", plan: "PAYG", status: "expiring", loginUrl: "https://platform.openai.com/", nextRenewal: now + (sevenDays / 2), notes: "GPT-4" },
      { service: "Groq", plan: "Free / Llama-3", status: "active", loginUrl: "https://console.groq.com/", nextRenewal: now + thirtyDays, notes: "AI Inference" },
      { service: "Cloudflare", plan: "PAYG", status: "active", loginUrl: "https://dash.cloudflare.com/", nextRenewal: now + thirtyDays, notes: "Workers / R2 / AI" },
      { service: "Open Exchange", plan: "Free", status: "active", loginUrl: "https://openexchangerates.org/", nextRenewal: now + thirtyDays, notes: "Currency conversion" },
      { service: "Typesense", plan: "PAYG", status: "active", loginUrl: "https://cloud.typesense.org/", nextRenewal: now + thirtyDays, notes: "Vector Search" },
      { service: "Ollama / Ngrok", plan: "Self-hosted", status: "active", loginUrl: "https://dashboard.ngrok.com/", nextRenewal: now + thirtyDays, notes: "Local AI Orchestration" },
    ];

    await Promise.all(
      initialServices.map((service) =>
        ctx.db.insert("admin_subscriptions", { ...service, lastChecked: now }),
      ),
    );

    return "Seeded " + initialServices.length + " services";
  },
});
