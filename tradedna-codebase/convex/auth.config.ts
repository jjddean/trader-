import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Set this in the Convex dashboard or .env for local emulation
      // e.g., https://verb-noun-00.clerk.accounts.dev
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
