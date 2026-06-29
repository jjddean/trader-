import { decryptHmrcSecret, encryptHmrcSecret } from "./hmrc_token_crypto";

export interface HmrcTokenDbRow {
  accessToken?: string;
  refreshToken?: string;
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  expiresAt?: number;
  eori?: string;
}

export interface HmrcTokenSecrets {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  eori?: string;
}

export async function encryptHmrcTokensForStorage(
  accessToken: string,
  refreshToken?: string,
): Promise<{ accessTokenEncrypted: string; refreshTokenEncrypted?: string }> {
  const accessTokenEncrypted = await encryptHmrcSecret(accessToken);
  const refreshTokenEncrypted = refreshToken ? await encryptHmrcSecret(refreshToken) : undefined;
  return { accessTokenEncrypted, refreshTokenEncrypted };
}

/** Decrypt stored tokens; falls back to legacy plaintext columns during migration. */
export async function decryptHmrcTokensFromRow(row: HmrcTokenDbRow): Promise<HmrcTokenSecrets> {
  let accessToken = typeof row.accessToken === "string" ? row.accessToken : undefined;
  let refreshToken = typeof row.refreshToken === "string" ? row.refreshToken : undefined;

  if (row.accessTokenEncrypted) {
    accessToken = await decryptHmrcSecret(row.accessTokenEncrypted);
  }
  if (row.refreshTokenEncrypted) {
    refreshToken = await decryptHmrcSecret(row.refreshTokenEncrypted);
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: row.expiresAt,
    eori: row.eori,
  };
}
