const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlatformOverviewSnapshot } = require("../services/platform.service");

test("buildPlatformOverviewSnapshot computes readiness and integration posture", () => {
  const snapshot = buildPlatformOverviewSnapshot({
    user: {
      organizationName: "Campus Ops",
      organizationSlug: "campus-ops-demo",
      industry: "Smart Buildings",
      teamName: "Operations",
      plan: "growth",
      role: "owner",
      status: "active",
      apiAccessEnabled: true,
      mfaEnabled: true,
      dataRetentionDays: 730,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      lastLoginAt: new Date("2026-03-28T00:00:00.000Z"),
    },
    latestTelemetry: {
      timestamp: new Date().toISOString(),
    },
    sensors: [
      { status: "ONLINE", lastSeen: new Date().toISOString() },
      { status: "DEGRADED", lastSeen: new Date().toISOString() },
    ],
    alerts: [
      { severity: "HIGH", status: "OPEN" },
    ],
    apiKeys: [
      { status: "ACTIVE", expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
    ],
    auditLogs: [
      { _id: "1", action: "platform.api_key.created", category: "platform", severity: "HIGH", status: "SUCCESS", createdAt: new Date().toISOString() },
    ],
  });

  assert.equal(snapshot.workspace.role, "OWNER");
  assert.equal(snapshot.workspace.plan, "GROWTH");
  assert.equal(snapshot.operations.sensors.total, 2);
  assert.equal(snapshot.operations.apiKeys.active, 1);
  assert.equal(snapshot.integrations.length >= 3, true);
  assert.equal(typeof snapshot.readiness.score, "number");
});
