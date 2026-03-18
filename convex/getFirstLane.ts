import { mutation } from "./_generated/server";

export default mutation({
  handler: async (ctx) => {
    return await ctx.db.query("declarations").first();
  },
});
