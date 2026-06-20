"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  login_required:
    "Clerk session was lost during the HMRC redirect. Sign in again, then click Connect HMRC once.",
  state_mismatch: "OAuth state did not match your session. Click Connect HMRC once and complete the flow without opening extra tabs.",
  pkce_missing:
    "OAuth security token missing after HMRC redirect. Click Connect HMRC once (do not double-click).",
  token_exchange_failed:
    "HMRC rejected the token exchange (see detail below). Usually redirect URI mismatch or PKCE verifier missing.",
  invalid_request: "HMRC rejected the authorize request. Check redirect URI and scopes in Hub.",
  internal_error: "Unexpected error saving HMRC tokens. Check the dev server log for details.",
};

function resolveMessage(error: string, msg: string | null): string {
  const base = ERROR_MESSAGES[error] ?? `HMRC connect failed (${error}).`;
  if (!msg) return base;
  const detail = decodeURIComponent(msg);
  return `${base} — ${detail}`;
}

export function HmrcConnectBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const detail = searchParams.get("msg");

  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      router.replace("/dashboard");
    }, 12000);
    return () => clearTimeout(t);
  }, [error, success, router]);

  if (success === "hmrc_connected") {
    return (
      <div className="mx-8 mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        HMRC connected successfully. You can submit declarations from this account.
      </div>
    );
  }

  if (!error) return null;

  return (
    <div className="mx-8 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="font-medium">Connect HMRC failed</p>
      <p className="mt-1">{resolveMessage(error, detail)}</p>
    </div>
  );
}
