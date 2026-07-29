/**
 * Smoke test: audit log rows must not put entityId/ipAddress at top level (Convex schema).
 * Run: node scripts/smoke-audit-log-shape.mjs
 */

const AUDIT_SCHEMA_KEYS = new Set([
  "userId",
  "action",
  "details",
  "timestamp",
  "archived",
]);

function buildAuditInsert(args) {
  const { metadata, entityId, ipAddress, ...rest } = args;
  const details =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : metadata !== undefined
        ? { value: metadata }
        : {};
  if (entityId) details.entityId = entityId;
  if (ipAddress) details.ipAddress = ipAddress;
  return {
    ...rest,
    details: Object.keys(details).length > 0 ? details : undefined,
    timestamp: Date.now(),
    archived: false,
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return false;
  }
  console.log("OK:", message);
  return true;
}

const sample = buildAuditInsert({
  action: "financial_variance_detected",
  userId: "user_test",
  entityId: "decl_123",
  metadata: {
    mrn: "26GB6F5SZ14GXLAAR2",
    dutyVarianceAmount: 0,
    vatVarianceAmount: 200,
    varianceKinds: ["vat_higher_than_hmrc"],
  },
});

const topKeys = Object.keys(sample);
assert(!topKeys.includes("entityId"), "entityId not at top level");
assert(!topKeys.includes("ipAddress"), "ipAddress not at top level");
assert(
  topKeys.every((k) => AUDIT_SCHEMA_KEYS.has(k)),
  `top-level keys only schema fields: ${topKeys.join(", ")}`,
);
assert(sample.details?.entityId === "decl_123", "entityId stored in details");
assert(sample.details?.mrn === "26GB6F5SZ14GXLAAR2", "metadata merged into details");

if (process.exitCode !== 1) {
  console.log("\nAll audit shape checks passed.");
}
