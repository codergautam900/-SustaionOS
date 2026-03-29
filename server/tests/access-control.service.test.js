const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
