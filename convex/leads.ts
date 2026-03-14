// Convex leads logic
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listLeads = query({
  args: {
    country: v.optional(v.string()),
    hsCode: v.optional(v.string()),
    laneId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query;
    if (args.laneId) {
      query = ctx.db
        .query("prospects")
        .withIndex("by_lane", (q) => q.eq("laneId", args.laneId));
    } else if (args.country) {
      query = ctx.db
        .query("prospects")
        .withIndex("by_country", (q) => q.eq("country", args.country as string));
    } else {
      query = ctx.db.query("prospects").order("desc");
    }

    let leads = await query.collect();
    
    // Only apply memory filtering for global list, or if explicitly requested without lane context
    if (args.hsCode && !args.laneId) {
      const code = args.hsCode;
      leads = leads.filter((l) => l.primaryHS && l.primaryHS.startsWith(code));
    }

    return leads;
  },
});

export const getLead = query({
  args: { id: v.id("prospects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});


// Live sync from AI Agents / Discovery
export const syncHMRCLeads = mutation({
  args: {
    leads: v.array(v.object({
      companyName: v.string(),
      country: v.string(),
      dctsTier: v.string(),
      businessCategory: v.string(),
      primaryHS: v.string(),
      contactEmail: v.optional(v.string()),
      reliabilityScore: v.number(),
      status: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    let newCount = 0;
    for (const lead of args.leads) {
      const existing = await ctx.db
        .query("prospects")
        .withIndex("by_country", (q) => q.eq("country", lead.country))
        .filter((q) => q.eq(q.field("companyName"), lead.companyName))
        .first();

      if (!existing) {
        await ctx.db.insert("prospects", {
          ...lead,
          lastShipmentDate: Date.now() - Math.random() * 100000000,
        });
        newCount++;
      }
    }

    return { success: true, count: newCount };
  },
});

export const clearAllLeads = mutation({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("prospects").collect();
    for (const lead of leads) {
        await ctx.db.delete(lead._id);
    }
    return { success: true, count: leads.length };
  },
});

export const createProspect = mutation({
  args: {
    companyName: v.string(),
    country: v.string(),
    dctsTier: v.string(),
    primaryHS: v.string(),
    contactEmail: v.optional(v.string()),
    reliabilityScore: v.optional(v.number()),
    status: v.optional(v.string()),
    laneId: v.optional(v.string()),
    businessCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already in this pipeline
    let existingQuery = ctx.db
      .query("prospects")
      .withIndex("by_country", (q) => q.eq("country", args.country))
      .filter((q) => q.eq(q.field("companyName"), args.companyName));

    if (args.laneId) {
      existingQuery = existingQuery.filter((q) => q.eq(q.field("laneId"), args.laneId));
    }

    const existing = await existingQuery.first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("prospects", {
      ...args,
      dctsTier: args.dctsTier,
      businessCategory: args.businessCategory,
      reliabilityScore: args.reliabilityScore ?? 0.85,
      status: args.status ?? "New",
      lastShipmentDate: Date.now(),
    });
  },
});

