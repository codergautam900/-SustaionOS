const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPlanUsage,
  buildWorkspaceDefaults,
  getRoleCapabilities,
  hasMinimumRole,
  normalizeRole,
} = require("../services/accessControl.service");

test("normalizeRole upgrades legacy user role and keeps hierarchy checks working", () => {
  assert.equal(normalizeRole("user"), "ADMIN");
  assert.equal(hasMinimumRole("owner", "admin"), true);
  assert.equal(hasMinimumRole("viewer", "operator"), false);
});

test("buildWorkspaceDefaults returns SaaS-ready account metadata", () => {
  const defaults = buildWorkspaceDefaults({
    name: "Gautam",
    email: "gautam@example.com",
    organizationName: "Campus Ops",
  });

  assert.equal(defaults.organizationName, "Campus Ops");
  assert.equal(defaults.role, "ADMIN");
  assert.equal(defaults.plan, "STARTER");
  assert.equal(typeof defaults.organizationSlug, "string");
  assert.equal(defaults.organizationSlug.includes("campus-ops"), true);
  assert.equal(getRoleCapabilities("owner").includes("manage:security"), true);
});

test("buildPlanUsage flags near-limit and exceeded quotas", () => {
  const usage = buildPlanUsage("starter", {
    members: 3,
    apiKeys: 2,
    sensors: 26,
    monthlyTelemetry: 4200,
  });

  assert.equal(usage.plan, "STARTER");
  assert.equal(usage.metrics.find((item) => item.key === "members").nearLimit, true);
  assert.equal(usage.metrics.find((item) => item.key === "sensors").exceeded, true);
});
