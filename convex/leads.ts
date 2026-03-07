import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listLeads = query({
    args: {
        country: v.optional(v.string()),
        hsCode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let leads = await ctx.db.query("prospects").order("desc").collect();

        if (args.country) {
            leads = leads.filter(l => l.country === args.country);
        }
        if (args.hsCode) {
            const code = args.hsCode;
            leads = leads.filter(l => l.primaryHS.startsWith(code));
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

export const updateLeadStatus = mutation({
    args: {
        id: v.id("prospects"),
        status: v.string(), // "New", "Contacted", "Proposal Sent", "Client"
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { status: args.status });

        await ctx.db.insert("auditLogs", {
            userId: "system",
            action: "lead_status_updated",
            details: { leadId: args.id, newStatus: args.status },
            timestamp: Date.now(),
        });
    },
});

// Mock HMRC Sync to populate data for demo
export const syncHMRCLeads = mutation({
    args: {},
    handler: async (ctx) => {
        const mockLeads = [
            {
                companyName: "Dhaka Textiles Ltd",
                country: "Bangladesh",
                dctsTier: "Enhanced",
                primaryHS: "610910",
                contactEmail: "export@dhakatex.com",
                reliabilityScore: 0.95,
                status: "New",
            },
            {
                companyName: "Karachi Cotton Mills",
                country: "Pakistan",
                dctsTier: "Comprehensive",
                primaryHS: "520811",
                contactEmail: "info@karachicotton.pk",
                reliabilityScore: 0.88,
                status: "New",
            },
            {
                companyName: "Nairobi Bean Growers",
                country: "Kenya",
                dctsTier: "Comprehensive",
                primaryHS: "090121",
                contactEmail: "sales@nairobibeans.ke",
                reliabilityScore: 0.92,
                status: "New",
            },
            {
                companyName: "Phnom Penh Garments",
                country: "Cambodia",
                dctsTier: "Enhanced",
                primaryHS: "620462",
                contactEmail: "admin@ppgarments.com.kh",
                reliabilityScore: 0.85,
                status: "New",
            }
        ];

        for (const lead of mockLeads) {
            const existing = await ctx.db
                .query("prospects")
                .withIndex("by_country", (q) => q.eq("country", lead.country))
                .filter((q) => q.eq(q.field("companyName"), lead.companyName))
                .first();

            if (!existing) {
                await ctx.db.insert("prospects", {
                    ...lead,
                    lastShipmentDate: Date.now() - (Math.random() * 1000000000),
                });
            }
        }

        return { success: true, count: mockLeads.length };
    },
});
