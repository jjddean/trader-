import { action } from "./_generated/server";
import { v } from "convex/values";

// Compatibility-only action retained for the unused legacy ChatSidebar component.
// The live assistant path is strictly:
// UI -> /api/ai/chat -> AI
export const sendChatMessage = action({
  args: {
    declarationId: v.id("declarations"),
    messageBody: v.string(),
  },
  handler: async () => {
    throw new Error("Deprecated assistant action. Use /api/ai/chat as the single AI execution path.");
  },
});
