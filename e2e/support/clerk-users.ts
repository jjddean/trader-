import { createClerkClient } from "@clerk/backend";

/**
 * Clerk test users for e2e journeys.
 *
 * `+clerk_test` addresses only work on a Clerk development instance, where they
 * skip real email delivery. Users are created through the Backend API rather
 * than driven through the sign-up UI: the UI path adds Clerk's own flow to
 * every test, and we are here to test FreightCode's onboarding, not Clerk's.
 */
const secretKey = process.env.CLERK_SECRET_KEY ?? "";

if (secretKey && !secretKey.startsWith("sk_test_")) {
  throw new Error("e2e clerk helpers refuse to run against a Clerk production instance");
}

const backend = createClerkClient({ secretKey });

export const E2E_PASSWORD = "Fc-E2E-Onboarding-2026!";

/** Stable per-journey address so a rerun exercises the "returning user" path. */
export function testEmail(tag: string): string {
  return `freightcode.e2e.${tag}+clerk_test@example.com`;
}

export async function deleteTestUsers(email: string): Promise<void> {
  const { data } = await backend.users.getUserList({ emailAddress: [email] });
  for (const user of data) {
    await backend.users.deleteUser(user.id);
  }
}

/** Always starts from a brand-new Clerk user id, which is what the lock-out bug turned on. */
export async function createFreshTestUser(email: string): Promise<{ userId: string }> {
  await deleteTestUsers(email);
  const user = await backend.users.createUser({
    emailAddress: [email],
    password: E2E_PASSWORD,
    skipPasswordChecks: true,
  });
  return { userId: user.id };
}
