import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import {
  END_USER_STATEMENT_MAX_BYTES,
  endUserCredentialFromRequest,
  endUserRequestIsSameOrigin,
  expiredEndUserCookie,
} from "@/lib/export-controls/end-user-session";
import { readRequestBodyLimited } from "@/lib/export-controls/partner-signature";
import { ApiRateLimiter } from "@/lib/api-rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formReadLimiter = new ApiRateLimiter(120, 10 * 60 * 1000);
const formSubmitLimiter = new ApiRateLimiter(10, 10 * 60 * 1000);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function unavailable(status = 401) {
  const response = json({ error: "Form unavailable" }, status);
  response.cookies.set(expiredEndUserCookie());
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function requiredText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= maxLength;
}

function optionalText(value: unknown, maxLength: number): boolean {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function validRoles(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = [
    "consignee",
    "endUser",
    "intermediateUser",
    "ultimateEndUser",
    "stockistNoOrders",
    "stockistConfirmed",
  ] as const;
  return (
    hasOnlyKeys(value, keys) &&
    keys.every((key) => typeof value[key] === "boolean") &&
    keys.some((key) => value[key] === true)
  );
}

function validItems(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 100) return false;
  return value.every(
    (item) =>
      isRecord(item) &&
      hasOnlyKeys(item, ["description", "quantity", "unit"]) &&
      requiredText(item.description, 2_000) &&
      optionalText(item.quantity, 100) &&
      optionalText(item.unit, 100),
  );
}

function validWebsite(value: unknown): boolean {
  if (value === undefined || value === "") return true;
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validEusu(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const allowed = [
    "roles",
    "exporterName",
    "exporterLicenceRef",
    "items",
    "consigneeName",
    "consigneeAddress",
    "endUserWebsite",
    "armedForces",
    "incorporation",
    "soleUser",
    "otherSupportingInfo",
    "intermediateUserDetails",
    "intermediateUse",
    "newProductDescription",
    "ultimateEndUserDetails",
    "signatureSection",
    "signedJobRole",
    "stockistReExport",
    "stockistLikelyExports",
  ] as const;
  if (!hasOnlyKeys(value, allowed) || !validRoles(value.roles) || !validItems(value.items)) {
    return false;
  }
  if (
    !optionalText(value.exporterName, 300) ||
    !optionalText(value.exporterLicenceRef, 160) ||
    !optionalText(value.consigneeName, 300) ||
    !optionalText(value.consigneeAddress, 2_000) ||
    !validWebsite(value.endUserWebsite) ||
    !optionalBoolean(value.armedForces) ||
    !optionalBoolean(value.incorporation) ||
    !optionalBoolean(value.soleUser) ||
    !optionalText(value.otherSupportingInfo, 5_000) ||
    !optionalText(value.intermediateUserDetails, 5_000) ||
    !optionalText(value.intermediateUse, 5_000) ||
    !optionalText(value.newProductDescription, 5_000) ||
    !optionalText(value.ultimateEndUserDetails, 5_000) ||
    !optionalText(value.signedJobRole, 300) ||
    !optionalText(value.stockistLikelyExports, 5_000)
  ) {
    return false;
  }
  if (
    value.signatureSection !== undefined &&
    value.signatureSection !== "end_user" &&
    value.signatureSection !== "stockist"
  ) {
    return false;
  }
  return (
    value.stockistReExport === undefined ||
    value.stockistReExport === "no_reexport" ||
    value.stockistReExport === "likely_exports"
  );
}

function validSubmission(body: Record<string, unknown>): boolean {
  const allowed = [
    "endUserName",
    "endUserAddress",
    "endUserCountry",
    "contactName",
    "contactEmail",
    "intendedUse",
    "noProhibitedEndUse",
    "noDiversion",
    "signedBy",
    "eusu",
  ] as const;
  return (
    hasOnlyKeys(body, allowed) &&
    requiredText(body.endUserName, 300) &&
    optionalText(body.endUserAddress, 2_000) &&
    optionalText(body.endUserCountry, 120) &&
    requiredText(body.contactName, 300) &&
    optionalText(body.contactEmail, 254) &&
    (body.contactEmail === undefined ||
      body.contactEmail === "" ||
      (typeof body.contactEmail === "string" && EMAIL_PATTERN.test(body.contactEmail))) &&
    requiredText(body.intendedUse, 5_000) &&
    body.noProhibitedEndUse === true &&
    body.noDiversion === true &&
    requiredText(body.signedBy, 300) &&
    validEusu(body.eusu)
  );
}

export async function GET(request: Request) {
  const credential = endUserCredentialFromRequest(request);
  if (!credential) return unavailable();
  if (!formReadLimiter.tryConsume(credential.tokenHash)) {
    return json({ error: "Request not accepted" }, 429);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return unavailable(503);
  try {
    const convex = new ConvexHttpClient(convexUrl);
    const form = await convex.query(api.compliance_end_user.getEndUserForm, credential);
    if (!form) return unavailable();
    await convex.mutation(api.compliance_end_user.markEndUserTokenOpened, credential);
    return json(form);
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  if (!endUserRequestIsSameOrigin(request)) {
    return json({ error: "Request not accepted" }, 403);
  }
  const credential = endUserCredentialFromRequest(request);
  if (!credential) return unavailable();
  if (!formSubmitLimiter.tryConsume(credential.tokenHash)) {
    return json({ error: "Request not accepted" }, 429);
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "Request not accepted" }, 415);

  let rawBody: string | null;
  try {
    rawBody = await readRequestBodyLimited(request, END_USER_STATEMENT_MAX_BYTES);
  } catch {
    return json({ error: "Request not accepted" }, 400);
  }
  if (rawBody === null) return json({ error: "Request not accepted" }, 413);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed) || !validSubmission(parsed)) {
      return json({ error: "Request not accepted" }, 400);
    }
    body = parsed;
  } catch {
    return json({ error: "Request not accepted" }, 400);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return unavailable(503);
  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.mutation(api.compliance_end_user.submitEndUserStatement, {
      ...credential,
      endUserName: body.endUserName as string,
      endUserAddress: (body.endUserAddress as string | undefined) ?? "",
      endUserCountry: (body.endUserCountry as string | undefined) ?? "",
      contactName: body.contactName as string,
      contactEmail:
        typeof body.contactEmail === "string" && body.contactEmail.trim()
          ? body.contactEmail
          : undefined,
      intendedUse: body.intendedUse as string,
      noProhibitedEndUse: true,
      noDiversion: true,
      signedBy: body.signedBy as string,
      eusu: body.eusu as never,
    });
    return json({ ok: true, statement: result.statement });
  } catch {
    return unavailable(409);
  }
}
