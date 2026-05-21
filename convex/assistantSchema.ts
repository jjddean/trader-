import { defineTable } from "convex/server";
import { v } from "convex/values";

export const assistantChatTables = {
  messages: defineTable({
    orgId: v.id("organizations"),
    declarationId: v.id("declarations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_declaration", ["declarationId"]),
};