import { v } from "convex/values";

// Kept as a small shared validator module so existing generated imports remain valid.
// The authoritative assistant tables live in `convex/schema.ts`.
export const assistantRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
);
