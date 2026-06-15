#!/usr/bin/env node
/**
 * Verify Stripe → Convex subscription sync.
 *
 * Sends a signed checkout.session.completed payload to the Convex stripe-webhook
 * endpoint, then reads the subscriptions row via internal Convex query.
 *
 * Usage:
 *   node scripts/stripe-subscription-sync-test.mjs
 *
 * Requires in .env.local (or env):
 *   STRIPE_WEBHOOK_SECRET
 *   NEXT_PUBLIC_CONVEX_SITE_URL
 *   HMRC_TEST_USER_ID  (Clerk user id for test row)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim();
const userId =
  process.env.STRIPE_TEST_USER_ID?.trim() ||
  process.env.HMRC_TEST_USER_ID?.trim();

if (!webhookSecret) {
  try {
    webhookSecret = execSync("npx convex env get STRIPE_WEBHOOK_SECRET", {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT || "dev:glorious-marlin-243",
      },
      encoding: "utf8",
    }).trim();
  } catch {
    // fall through
  }
}

if (!webhookSecret || !siteUrl || !userId) {
  console.error(
    "Missing STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_CONVEX_SITE_URL, or test user id (HMRC_TEST_USER_ID).",
  );
  process.exit(1);
}

const customerId = `cus_test_${Date.now()}`;
const subscriptionId = `sub_test_${Date.now()}`;

const event = {
  id: `evt_test_${Date.now()}`,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_test_${Date.now()}`,
      object: "checkout.session",
      customer: customerId,
      subscription: subscriptionId,
      metadata: {
        userId,
        plan: "Professional",
      },
    },
  },
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const signature = crypto
  .createHmac("sha256", webhookSecret)
  .update(signedPayload, "utf8")
  .digest("hex");
const header = `t=${timestamp},v1=${signature}`;

const url = `${siteUrl.replace(/\/$/, "")}/stripe-webhook`;
console.log(`POST ${url}`);
console.log(`userId=${userId} plan=Professional`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "stripe-signature": header,
  },
  body: payload,
});

const text = await res.text();
console.log(`Webhook HTTP ${res.status}: ${text || "(empty)"}`);

if (!res.ok) {
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1500));

const argsJson = JSON.stringify({ userId });
const convexJson = execSync(
  `npx convex run subscriptions:getSubscriptionByUserIdInternal ${JSON.stringify(argsJson)}`,
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT || "dev:glorious-marlin-243",
    },
    encoding: "utf8",
  },
);

const row = JSON.parse(convexJson.trim() || "null");
console.log("Convex subscriptions row:", JSON.stringify(row, null, 2));

if (!row || row.stripeSubscriptionId !== subscriptionId) {
  console.error("FAIL: subscriptions row not updated (missing or wrong stripeSubscriptionId).");
  process.exit(1);
}

if (row.plan !== "Professional" || row.status !== "active") {
  console.error("FAIL: expected plan=Professional status=active.");
  process.exit(1);
}

console.log("PASS: checkout.session.completed synced subscriptions row.");
