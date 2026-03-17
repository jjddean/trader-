import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"
];

export const suggestFromHistory = query({
  args: {
    userId: v.string(),
    description: v.optional(v.string()), // Ignored for deterministic, but kept for interface match
    originCountry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.originCountry) return { hsCode: null, confidence: 0 };

    const records = await ctx.db
      .query("historical_declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("countryOfOriginCode"), args.originCountry))
      .collect();

    if (records.length === 0) return { hsCode: null, confidence: 0 };

    // Find the most frequent HS Code for this origin
    const frequency: Record<string, number> = {};
    let maxFreq = 0;
    let mostFrequentCode = null;

    for (const row of records) {
      if (!row.commodityCode) continue;
      frequency[row.commodityCode] = (frequency[row.commodityCode] || 0) + 1;
      if (frequency[row.commodityCode] > maxFreq) {
        maxFreq = frequency[row.commodityCode];
        mostFrequentCode = row.commodityCode;
      }
    }

    if (!mostFrequentCode) return { hsCode: null, confidence: 0 };

    // Calculate confidence based on frequency / total matches
    const confidence = Math.round((maxFreq / records.length) * 100);

    return {
      hsCode: mostFrequentCode,
      confidence,
    };
  },
});

export const getDashboardAnalytics = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("historical_declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    let totalDutyPaid = 0;
    const missedPreferences = [];
    const pvaChecks = [];
    const antiDumpingPenalties = [];
    const brokerStats: Record<string, { total: number; anomalies: number }> = {};
    const dutyReliefs = [];

    for (const record of records) {
      // Basic KPI
      if (record.taxLineTotalAmount && (!record.taxType || record.taxType !== "A30")) { // basic duty
        totalDutyPaid += record.taxLineTotalAmount;
      } else if (record.taxType === "A30" || record.taxType === "A35") {
        totalDutyPaid += record.taxLineTotalAmount || 0;
      }

      // 1. Missed EU Preference
      if (
        record.countryOfOriginCode &&
        EU_COUNTRIES.includes(record.countryOfOriginCode) &&
        record.preferenceCode !== "300" &&
        (record.taxLineTotalAmount || 0) > 0
      ) {
        missedPreferences.push(record);
        
        // Track broker anomaly
        if (record.declarantEori) {
          if (!brokerStats[record.declarantEori]) brokerStats[record.declarantEori] = { total: 0, anomalies: 0 };
          brokerStats[record.declarantEori].anomalies += 1;
        }
      }

      // 2. PVA Missing/Reconcile
      if (record.methodOfPaymentCode === "G") {
        pvaChecks.push(record);
      }

      // 3. Anti-Dumping Penalty
      if (record.taxType === "A30" || record.taxType === "A35") {
        antiDumpingPenalties.push(record);
        
        if (record.declarantEori) {
           if (!brokerStats[record.declarantEori]) brokerStats[record.declarantEori] = { total: 0, anomalies: 0 };
           brokerStats[record.declarantEori].anomalies += 1;
        }
      }

      // 5. Duty Relief Expiry
      if (record.customsProcedureCodeCpc?.includes("C605") || record.customsProcedureCodeCpc?.startsWith("51")) {
        dutyReliefs.push(record);
      }

      // 4. Broker Score (Denominator)
      if (record.declarantEori) {
          if (!brokerStats[record.declarantEori]) brokerStats[record.declarantEori] = { total: 0, anomalies: 0 };
          brokerStats[record.declarantEori].total += 1;
      }
    }

    // Calculate Missed Savings £
    const totalMissedSavings = missedPreferences.reduce((acc, curr) => acc + (curr.taxLineTotalAmount || 0), 0);

    // Calculate Compliance Score 
    // Basic Algo: 100 - (Anomalies / Total) * 100
    const totalAnomalies = missedPreferences.length + antiDumpingPenalties.length;
    let complianceScore = 100;
    if (records.length > 0) {
      complianceScore = Math.max(0, 100 - ((totalAnomalies / records.length) * 100));
    }

    // Format Broker Scores
    const brokerAccuracy = Object.entries(brokerStats).map(([eori, stats]) => ({
      eori,
      accuracy: 100 - ((stats.anomalies / stats.total) * 100),
      totalDeclarations: stats.total
    }));

    return {
      kpis: {
        totalDutyPaid,
        totalMissedSavings,
        complianceScore: complianceScore.toFixed(1),
        totalRecords: records.length,
        anomaliesCount: totalAnomalies
      },
      alerts: {
        missedPreferences,
        pvaChecks,
        antiDumpingPenalties,
        dutyReliefs
      },
      brokerAccuracy
    };
  },
});

export const loadMockData = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Check if data already exists
    const existing = await ctx.db
      .query("historical_declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
      
    if (existing) return;

    // Load the user's specific test case
    const mockRows = [
      {
        userId: args.userId,
        entryIdentifierMrn: "MRN_001",
        declarantEori: "GB_BROKER_1",
        countryOfOriginCode: "FR",
        preferenceCode: "100",
        itemCustomsValue: 5000.0,
        taxLineTotalAmount: 400.0,
        methodOfPaymentCode: "M",
        createdAt: Date.now() - 100000,
      },
      {
        userId: args.userId,
        entryIdentifierMrn: "MRN_002",
        declarantEori: "GB_BROKER_2",
        countryOfOriginCode: "CN",
        preferenceCode: "100",
        itemCustomsValue: 2000.0,
        taxLineTotalAmount: 840.0,
        taxType: "A30",
        methodOfPaymentCode: "M",
        createdAt: Date.now() - 50000,
      },
      {
        userId: args.userId,
        entryIdentifierMrn: "MRN_003",
        declarantEori: "GB_BROKER_1",
        countryOfOriginCode: "DE",
        preferenceCode: "300",
        itemCustomsValue: 1000.0,
        taxLineTotalAmount: 0.0,
        methodOfPaymentCode: "G",
        createdAt: Date.now(),
      }
    ];

    for (const row of mockRows) {
      await ctx.db.insert("historical_declarations", row);
    }
  }
});
