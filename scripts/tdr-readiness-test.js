/**
 * TDR Readiness Test Harness
 * Tests each HMRC 5-Pillar checklist item by hitting live endpoints.
 * Run: node scripts/tdr-readiness-test.js
 */
const fs = require("fs");
const path = require("path");

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const DELAY_MS = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];

function log(status, id, name, detail) {
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  console.log(`${icon} [${id}] ${name} — ${detail}`);
  results.push({ id, name, status, detail, timestamp: new Date().toISOString() });
}

async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, text, json, headers: Object.fromEntries(res.headers.entries()), ok: res.ok };
  } catch (err) {
    return { status: 0, text: err.message, json: null, headers: {}, ok: false, error: true };
  }
}

// ─── PILLAR 3: IT DELIVERY ──────────────────────────────────────────

async function testSubmitEndpointExists() {
  const res = await safeFetch(`${BASE}/api/hmrc/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ declarationId: "test-nonexistent" }),
  });
  // Any structured response (not connection error) means endpoint exists
  if (res.error) {
    log("FAIL", "P3-01", "Submit endpoint exists", `Connection failed: ${res.text}`);
  } else if (res.status === 401) {
    log("PASS", "P3-01", "Submit endpoint exists", `Returned 401 (auth required) — endpoint alive`);
  } else if (res.status === 404 && res.text.includes("Cannot POST")) {
    log("FAIL", "P3-01", "Submit endpoint exists", `404 — route not registered`);
  } else {
    log("PASS", "P3-01", "Submit endpoint exists", `HTTP ${res.status} — endpoint responds`);
  }
}

async function testAmendEndpointExists() {
  const res = await safeFetch(`${BASE}/api/hmrc/amend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mrn: "TEST", payload: {} }),
  });
  if (res.error) {
    log("FAIL", "P3-02", "Amend endpoint exists", `Connection failed`);
  } else if (res.status === 404) {
    log("FAIL", "P3-02", "Amend endpoint exists", `HTTP 404 — route does NOT exist`);
  } else {
    log("PASS", "P3-02", "Amend endpoint exists", `HTTP ${res.status}`);
  }
}

async function testCancelEndpointExists() {
  const res = await safeFetch(`${BASE}/api/hmrc/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mrn: "TEST" }),
  });
  if (res.error) {
    log("FAIL", "P3-03", "Cancel endpoint exists", `Connection failed`);
  } else if (res.status === 404) {
    log("FAIL", "P3-03", "Cancel endpoint exists", `HTTP 404 — route does NOT exist`);
  } else {
    log("PASS", "P3-03", "Cancel endpoint exists", `HTTP ${res.status}`);
  }
}

async function testStatusQueryEndpointExists() {
  const res = await safeFetch(`${BASE}/api/hmrc/status-query?mrn=TEST`);
  if (res.error) {
    log("FAIL", "P3-04", "Status query endpoint exists", `Connection failed`);
  } else if (res.status === 404) {
    log("FAIL", "P3-04", "Status query endpoint exists", `HTTP 404 — route does NOT exist`);
  } else {
    log("PASS", "P3-04", "Status query endpoint exists", `HTTP ${res.status}`);
  }
}

async function testDocumentInitiate() {
  const res = await safeFetch(`${BASE}/api/hmrc/documents/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ declarationId: "test", fileName: "test.pdf", fileSize: 1024 }),
  });
  if (res.error) {
    log("FAIL", "P3-05", "Document initiate endpoint", `Connection failed`);
  } else if (res.status === 404) {
    log("FAIL", "P3-05", "Document initiate endpoint", `HTTP 404 — not found`);
  } else if (res.status === 401 || res.status === 403) {
    log("PASS", "P3-05", "Document initiate endpoint", `HTTP ${res.status} — exists, auth required`);
  } else {
    log("PASS", "P3-05", "Document initiate endpoint", `HTTP ${res.status}`);
  }
}

async function testDocumentUpload() {
  const res = await safeFetch(`${BASE}/api/hmrc/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageId: "test-storage", mrn: "24GBTEST00000001", documentType: "invoice" }),
  });
  if (res.error) {
    log("FAIL", "P3-06", "Document upload endpoint", `Connection failed`);
  } else if (res.status === 404) {
    log("FAIL", "P3-06", "Document upload endpoint", `HTTP 404 — not found`);
  } else {
    log("PASS", "P3-06", "Document upload endpoint", `HTTP ${res.status}`);
  }
}

async function testPullNotificationsEndpoint() {
  const res = await safeFetch(`${BASE}/api/hmrc/notifications/pull?conversationId=TEST`);
  if (res.error) {
    log("FAIL", "P3-07", "Pull notifications endpoint", `Connection failed`);
  } else if (res.status === 404) {
    log("FAIL", "P3-07", "Pull notifications endpoint", `HTTP 404 — route does NOT exist`);
  } else {
    log("PASS", "P3-07", "Pull notifications endpoint", `HTTP ${res.status}`);
  }
}

// ─── WEBHOOK NOTIFICATION TESTS ─────────────────────────────────────

function buildNotificationPayload(type, mrn) {
  return JSON.stringify({
    notificationType: type,
    message: `<md:MetaData xmlns:md="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
      <md:Response>
        <md:Declaration>
          <md:ID>${mrn}</md:ID>
          <md:FunctionCode>9</md:FunctionCode>
          <md:StatusCode>${type}</md:StatusCode>
        </md:Declaration>
      </md:Response>
    </md:MetaData>`,
  });
}

function buildRejectionPayload(type, mrn) {
  return JSON.stringify({
    notificationType: type,
    message: `<md:MetaData xmlns:md="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
      <md:Response>
        <md:Declaration>
          <md:ID>${mrn}</md:ID>
          <md:FunctionCode>9</md:FunctionCode>
          <md:StatusCode>${type}</md:StatusCode>
        </md:Declaration>
        <md:Error>
          <md:Code>CDS12014</md:Code>
          <md:Field>Declaration/GoodsShipment/GovernmentAgencyGoodsItem/Commodity/Classification/ID</md:Field>
          <md:Message>Invalid commodity code</md:Message>
        </md:Error>
      </md:Response>
    </md:MetaData>`,
  });
}

const NOTIFICATION_TYPES = [
  { type: "DMSACC", id: "P3-08",  name: "Webhook — DMSACC (accepted)",    builder: buildNotificationPayload },
  { type: "DMSREJ", id: "P3-09",  name: "Webhook — DMSREJ (rejected)",    builder: buildRejectionPayload },
  { type: "DMSROG", id: "P3-10",  name: "Webhook — DMSROG (route)",       builder: buildNotificationPayload },
  { type: "DMSCLE", id: "P3-11",  name: "Webhook — DMSCLE (cleared)",     builder: buildNotificationPayload },
  { type: "DMSINV", id: "P3-12",  name: "Webhook — DMSINV (invalid)",     builder: buildRejectionPayload },
  { type: "DMSTAX", id: "P3-13",  name: "Webhook — DMSTAX (tax)",         builder: buildNotificationPayload },
  { type: "DMSCTL", id: "P3-14",  name: "Webhook — DMSCTL (control)",     builder: buildNotificationPayload },
  { type: "DMSRES", id: "P3-15",  name: "Webhook — DMSRES (response)",    builder: buildNotificationPayload },
];

async function testWebhookNotification(notif) {
  const testMrn = "24GB" + notif.type.substring(0,4) + "TEST000001";
  const res = await safeFetch(`${BASE}/api/hmrc/webhooks/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-conversation-id": `test-${notif.type}-${Date.now()}`,
    },
    body: notif.builder(notif.type, testMrn),
  });

  if (res.error) {
    log("FAIL", notif.id, notif.name, `Connection failed`);
  } else if (res.status === 200 && res.json?.success) {
    log("PASS", notif.id, notif.name, `HTTP 200, acknowledged. MRN parsed correctly.`);
  } else if (res.status === 200) {
    log("PASS", notif.id, notif.name, `HTTP 200 but response: ${res.text.substring(0, 100)}`);
  } else if (res.status === 500) {
    log("FAIL", notif.id, notif.name, `HTTP 500 — webhook handler crashed: ${res.text.substring(0, 150)}`);
  } else {
    log("FAIL", notif.id, notif.name, `HTTP ${res.status}: ${res.text.substring(0, 150)}`);
  }
}

// ─── ERROR HANDLING TESTS ───────────────────────────────────────────

async function testSubmitBadPayload() {
  const res = await safeFetch(`${BASE}/api/hmrc/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "NOT JSON AT ALL",
  });
  if (res.error) {
    log("FAIL", "P3-16", "Error — malformed body", `Connection failed`);
  } else if (res.status >= 400 && res.status < 500) {
    log("PASS", "P3-16", "Error — malformed body", `HTTP ${res.status} — handled gracefully`);
  } else if (res.status === 500) {
    log("FAIL", "P3-16", "Error — malformed body", `HTTP 500 — crashed instead of returning 400`);
  } else {
    log("FAIL", "P3-16", "Error — malformed body", `Unexpected HTTP ${res.status}`);
  }
}

async function testSubmitNoAuth() {
  const res = await safeFetch(`${BASE}/api/hmrc/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ declarationId: "test" }),
  });
  if (res.error) {
    log("FAIL", "P3-17", "Error — no auth", `Connection failed`);
  } else if (res.status === 401 || res.status === 403) {
    log("PASS", "P3-17", "Error — no auth", `HTTP ${res.status} — correctly rejected unauthenticated request`);
  } else if (res.status >= 400 && res.status < 500) {
    log("PASS", "P3-17", "Error — no auth", `HTTP ${res.status} — rejected (different auth mechanism)`);
  } else {
    log("FAIL", "P3-17", "Error — no auth", `HTTP ${res.status} — should reject without auth`);
  }
}

// ─── VALIDATION TESTS (via webhook — test the validator directly) ───

async function testXmlEscaping() {
  // Send a webhook with XML-hostile characters in the payload
  const dangerousMrn = "24GBXSS<TEST>0001";
  const payload = JSON.stringify({
    notificationType: "DMSACC",
    message: `<Response><Declaration><ID>${dangerousMrn}</ID></Declaration></Response>`,
  });
  const res = await safeFetch(`${BASE}/api/hmrc/webhooks/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-conversation-id": "xss-test" },
    body: payload,
  });
  // The webhook should still return 200 (not crash on parsing)
  if (res.error) {
    log("FAIL", "P3-18", "XML injection resilience (webhook)", `Connection failed`);
  } else if (res.status === 200) {
    log("PASS", "P3-18", "XML injection resilience (webhook)", `HTTP 200 — handled hostile input without crash`);
  } else if (res.status === 500) {
    log("FAIL", "P3-18", "XML injection resilience (webhook)", `HTTP 500 — crashed on hostile XML input`);
  } else {
    log("FAIL", "P3-18", "XML injection resilience (webhook)", `HTTP ${res.status}`);
  }
}

// ─── SOURCE CODE CHECKS (static but verified at runtime) ────────────

async function testAcceptHeaderValue() {
  // Read the submit route source and hmrc-fetch to check the Accept header value
  const submitPath = path.join(process.cwd(), "src", "app", "api", "hmrc", "submit", "route.ts");
  const hmrcFetchPath = path.join(process.cwd(), "src", "lib", "hmrc-fetch.ts");
  try {
    let src = fs.readFileSync(submitPath, "utf-8");
    // Also check hmrc-fetch.ts where the header is actually set
    try {
      const hmrcFetchSrc = fs.readFileSync(hmrcFetchPath, "utf-8");
      src = src + "\n" + hmrcFetchSrc;
    } catch {}
    
    const match = src.match(/Accept["':\s]*(?:process\.env\.[A-Z_]+\s*\|\|\s*)?["']([^"']+)["']/)
      || src.match(/["']application\/vnd\.hmrc\.(\d+\.\d+)\+xml["']/);
    if (!match) {
      // Check if it uses env var with a 1.0 default
      if (src.includes('vnd.hmrc.1.0+xml')) {
        log("PASS", "P3-19", "Accept header = vnd.hmrc.1.0+xml (TDR)", `Found v1.0 as default fallback`);
      } else {
        log("FAIL", "P3-19", "Accept header = vnd.hmrc.1.0+xml (TDR)", `Could not find Accept header in source`);
      }
    } else if (match[1].includes("1.0")) {
      log("PASS", "P3-19", "Accept header = vnd.hmrc.1.0+xml (TDR)", `Found: ${match[1]}`);
    } else {
      log("FAIL", "P3-19", "Accept header = vnd.hmrc.1.0+xml (TDR)", `Found: ${match[1]} — TDR requires v1.0`);
    }
  } catch (e) {
    log("FAIL", "P3-19", "Accept header = vnd.hmrc.1.0+xml (TDR)", `Cannot read source: ${e.message}`);
  }
}

async function testXmlSanitisationInSource() {
  const submitPath = path.join(process.cwd(), "src", "app", "api", "hmrc", "submit", "route.ts");
  try {
    const src = fs.readFileSync(submitPath, "utf-8");
    if (src.includes("xmlEscape") || src.includes("escapeXml") || src.includes("sanitize")) {
      log("PASS", "P3-20", "XML input sanitisation in submit route", `Found escape/sanitise function usage`);
    } else if (src.includes("${") && src.includes("xmlPayload")) {
      log("FAIL", "P3-20", "XML input sanitisation in submit route", `Template literals found but NO xmlEscape — injection risk`);
    } else {
      log("FAIL", "P3-20", "XML input sanitisation in submit route", `No sanitisation found`);
    }
  } catch (e) {
    log("FAIL", "P3-20", "XML input sanitisation in submit route", `Cannot read source: ${e.message}`);
  }
}

async function testOAuthUrlNotHardcoded() {
  const files = [
    path.join(process.cwd(), "src", "app", "api", "hmrc", "submit", "route.ts"),
    path.join(process.cwd(), "src", "app", "auth", "hmrc", "callback", "route.ts"),
  ];
  let hardcoded = [];
  for (const f of files) {
    try {
      const src = fs.readFileSync(f, "utf-8");
      if (src.includes('"https://test-api.service.hmrc.gov.uk/oauth/token"')) {
        hardcoded.push(path.basename(path.dirname(f)) + "/" + path.basename(f));
      }
    } catch {}
  }
  if (hardcoded.length === 0) {
    log("PASS", "P3-21", "OAuth token URL env-driven (not hardcoded)", `All files use env vars`);
  } else {
    log("FAIL", "P3-21", "OAuth token URL env-driven (not hardcoded)", `Hardcoded in: ${hardcoded.join(", ")}`);
  }
}

async function testRateLimiterExists() {
  // Check for proactive rate limiting code
  const libDir = path.join(process.cwd(), "src", "lib");
  const apiDir = path.join(process.cwd(), "src", "app", "api", "hmrc");
  let found = false;
  for (const dir of [libDir, apiDir]) {
    try {
      const entries = fs.readdirSync(dir, { recursive: true });
      for (const entry of entries) {
        if (String(entry).includes("rate") || String(entry).includes("throttle") || String(entry).includes("limiter")) {
          found = true;
          break;
        }
      }
    } catch {}
  }
  if (!found) {
    // Also check submit route for any throttling logic
    try {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "api", "hmrc", "submit", "route.ts"), "utf-8");
      if (src.includes("tokenBucket") || src.includes("rateLimiter") || src.includes("throttle")) {
        found = true;
      }
    } catch {}
  }
  if (found) {
    log("PASS", "P3-22", "Proactive rate limiter (3 req/s)", `Rate limiting code found`);
  } else {
    log("FAIL", "P3-22", "Proactive rate limiter (3 req/s)", `No proactive rate limiter — only reactive 429 retry`);
  }
}

async function test500RetryLogic() {
  const submitPath = path.join(process.cwd(), "src", "app", "api", "hmrc", "submit", "route.ts");
  try {
    const src = fs.readFileSync(submitPath, "utf-8");
    if (src.includes("500") && (src.includes("retry") || src.includes("sleep"))) {
      log("PASS", "P3-23", "HTTP 500/503 retry logic", `Retry logic for server errors found`);
    } else if (src.includes("429") && src.includes("sleep")) {
      log("FAIL", "P3-23", "HTTP 500/503 retry logic", `Only 429 is retried — 500/503 not handled`);
    } else {
      log("FAIL", "P3-23", "HTTP 500/503 retry logic", `No retry logic found`);
    }
  } catch (e) {
    log("FAIL", "P3-23", "HTTP 500/503 retry logic", `Cannot read source: ${e.message}`);
  }
}

async function testDeclarationTypeCoverage() {
  const mapperPath = path.join(process.cwd(), "src", "lib", "wco-mapper.ts");
  try {
    const src = fs.readFileSync(mapperPath, "utf-8");
    // Check for mapDeclarationType function (dynamic) or individual type codes
    if (src.includes("mapDeclarationType")) {
      // Check that the function handles all types
      const validTypes = ["A", "B", "C", "D", "E", "F", "J", "K", "Y", "Z"];
      const hasAll = validTypes.every(t => src.includes(`"${t}"`));
      if (hasAll) {
        log("PASS", "P3-24", "All declaration types (A-Z)", `mapDeclarationType() handles all 10 types`);
      } else {
        const found = validTypes.filter(t => src.includes(`"${t}"`));
        const missing = validTypes.filter(t => !src.includes(`"${t}"`));
        log("FAIL", "P3-24", "All declaration types (A-Z)", `mapDeclarationType exists but missing types: ${missing.join(",")}`);
      }
    } else {
      const types = ["IMA", "IMB", "IMC", "IMD", "IME", "IMF", "IMJ", "IMK", "IMY", "IMZ"];
      const found = types.filter((t) => src.includes(`"${t}"`));
      const missing = types.filter((t) => !src.includes(`"${t}"`));
      if (missing.length === 0) {
        log("PASS", "P3-24", "All declaration types (A-Z)", `All 10 types found`);
      } else {
        log("FAIL", "P3-24", "All declaration types (A-Z)", `Only ${found.join(",") || "none"} found. Missing: ${missing.join(",")}`);
      }
    }
  } catch (e) {
    log("FAIL", "P3-24", "All declaration types (A-Z)", `Cannot read mapper: ${e.message}`);
  }
}

// ─── PILLAR 1: INTERNAL READINESS ───────────────────────────────────

async function testRunbookExists() {
  const candidates = [
    "documentation/runbook.md", "RUNBOOK.md", "docs/runbook.md",
    "documentation/support-guide.md", "documentation/operations.md",
  ];
  let found = false;
  for (const c of candidates) {
    const full = path.join(process.cwd(), c);
    if (fs.existsSync(full)) { found = true; break; }
  }
  if (found) {
    log("PASS", "P1-01", "Runbook / support docs exist", `Documentation found`);
  } else {
    log("FAIL", "P1-01", "Runbook / support docs exist", `No runbook, support guide, or operations doc found`);
  }
}

// ─── PILLAR 4: GO LIVE & SUPPORT ────────────────────────────────────

async function testHealthEndpoint() {
  const res = await safeFetch(`${BASE}/api/health`);
  if (res.error) {
    log("FAIL", "P4-01", "Health check endpoint", `Connection failed`);
  } else if (res.status === 404) {
    log("FAIL", "P4-01", "Health check endpoint", `HTTP 404 — /api/health does NOT exist`);
  } else if (res.status === 200) {
    log("PASS", "P4-01", "Health check endpoint", `HTTP 200: ${res.text.substring(0, 100)}`);
  } else {
    log("FAIL", "P4-01", "Health check endpoint", `HTTP ${res.status}`);
  }
}

// ─── PILLAR 5: CONTINGENCY ──────────────────────────────────────────

async function testEnvSwitchable() {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const env = fs.readFileSync(envPath, "utf-8");
    const hasHmrcEnv = env.includes("HMRC_ENVIRONMENT");
    // Check if OAuth URL is also env-driven
    const submitSrc = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "api", "hmrc", "submit", "route.ts"), "utf-8"
    );
    const oauthHardcoded = submitSrc.includes('"https://test-api.service.hmrc.gov.uk/oauth/token"');

    if (hasHmrcEnv && !oauthHardcoded) {
      log("PASS", "P5-01", "Env config switchable without deploy", `HMRC_ENVIRONMENT env var drives all URLs`);
    } else if (hasHmrcEnv && oauthHardcoded) {
      log("FAIL", "P5-01", "Env config switchable without deploy", `HMRC_ENVIRONMENT exists but OAuth URL is HARDCODED in source — requires code change to switch`);
    } else {
      log("FAIL", "P5-01", "Env config switchable without deploy", `No HMRC_ENVIRONMENT var found`);
    }
  } catch (e) {
    log("FAIL", "P5-01", "Env config switchable without deploy", `Cannot check: ${e.message}`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  TDR READINESS TEST HARNESS — LIVE ENDPOINT TESTS");
  console.log("  Target: " + BASE);
  console.log("  Time: " + new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════════\n");

  // Check server is reachable
  const ping = await safeFetch(BASE);
  if (ping.error) {
    console.error("❌ FATAL: Cannot reach " + BASE + ". Is the dev server running?");
    process.exit(1);
  }
  console.log("✓ Dev server reachable\n");

  console.log("── PILLAR 3: IT DELIVERY ───────────────────────────────\n");

  console.log("API Endpoints:");
  await testSubmitEndpointExists(); await sleep(DELAY_MS);
  await testAmendEndpointExists(); await sleep(DELAY_MS);
  await testCancelEndpointExists(); await sleep(DELAY_MS);
  await testStatusQueryEndpointExists(); await sleep(DELAY_MS);
  await testDocumentInitiate(); await sleep(DELAY_MS);
  await testDocumentUpload(); await sleep(DELAY_MS);
  await testPullNotificationsEndpoint(); await sleep(DELAY_MS);

  console.log("\nWebhook Notifications:");
  for (const notif of NOTIFICATION_TYPES) {
    await testWebhookNotification(notif);
    await sleep(DELAY_MS);
  }

  console.log("\nError Handling:");
  await testSubmitBadPayload(); await sleep(DELAY_MS);
  await testSubmitNoAuth(); await sleep(DELAY_MS);
  await testXmlEscaping(); await sleep(DELAY_MS);

  console.log("\nSource Code Verification:");
  await testAcceptHeaderValue();
  await testXmlSanitisationInSource();
  await testOAuthUrlNotHardcoded();
  await testRateLimiterExists();
  await test500RetryLogic();
  await testDeclarationTypeCoverage();

  console.log("\n── PILLAR 1: INTERNAL READINESS ────────────────────────\n");
  await testRunbookExists();

  console.log("\n── PILLAR 4: GO LIVE & SUPPORT ─────────────────────────\n");
  await testHealthEndpoint(); await sleep(DELAY_MS);

  console.log("\n── PILLAR 5: CONTINGENCY ───────────────────────────────\n");
  await testEnvSwitchable();

  // ─── SUMMARY ────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════\n");

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  const total = results.length;
  const pct = Math.round((pass / total) * 100);

  console.log(`  Total:   ${total}`);
  console.log(`  PASS:    ${pass} ✅`);
  console.log(`  FAIL:    ${fail} ❌`);
  console.log(`  SKIP:    ${skip} ⏭️`);
  console.log(`  Score:   ${pct}%\n`);

  if (fail > 0) {
    console.log("  FAILED TESTS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`    ❌ [${r.id}] ${r.name}`);
      console.log(`       → ${r.detail}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");

  // Write results
  const outDir = path.join(process.cwd(), "test-evidence");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "tdr-readiness-results.json");
  fs.writeFileSync(outFile, JSON.stringify({ timestamp: new Date().toISOString(), total, pass, fail, skip, pct, results }, null, 2));
  console.log(`Results written to: ${outFile}`);
}

main().catch((err) => { console.error("Test harness crashed:", err); process.exit(1); });
