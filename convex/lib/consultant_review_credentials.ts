import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertConsultantPartnerSecret } from "./secret_compare";

export interface ReviewCredentialInput {
  token?: string;
  tokenHash?: string;
  partnerSecret?: string;
}

/**
 * Resolve either a legacy raw token or a server-held hash credential.
 * Hash lookups require the Next/Convex shared secret so the hash cannot become
 * a second public bearer-token API.
 */
export async function findReviewCredential(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  input: ReviewCredentialInput,
) {
  const token = input.token?.trim();
  const tokenHash = input.tokenHash?.trim().toLowerCase();
  if ((token && tokenHash) || (!token && !tokenHash)) return null;

  if (tokenHash) {
    assertConsultantPartnerSecret(input.partnerSecret ?? "");
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
    return await ctx.db
      .query("export_review_tokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
  }

  // Plaintext consultant bearer tokens are permanently disabled. Legacy rows
  // remain readable only as audit records and cannot authenticate a request.
  return null;
}
