import path from "node:path";
import { config as loadEnv } from "dotenv";
import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Fetches a Clerk Testing Token so automated sign-ups are not blocked by bot
 * detection. Requires a Clerk *development* instance (pk_test / sk_test) — the
 * `+clerk_test` email addresses and the fixed 424242 code only exist there.
 */
export default async function globalSetup() {
  loadEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secretKey = process.env.CLERK_SECRET_KEY ?? "";

  if (!publishableKey || !secretKey) {
    throw new Error(
      "Clerk keys missing. e2e auth tests need NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.local.",
    );
  }
  if (!publishableKey.startsWith("pk_test_") || !secretKey.startsWith("sk_test_")) {
    throw new Error(
      "Refusing to run e2e auth tests against a Clerk production instance. Use a development instance (pk_test_/sk_test_).",
    );
  }

  await clerkSetup({ publishableKey, secretKey });
}
