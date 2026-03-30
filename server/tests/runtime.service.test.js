const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildHealthPayload,
  buildRuntimeWarnings,
  validateRuntimeConfig,
} = require("../services/runtime.service");

test("validateRuntimeConfig fails fast when JWT secret is missing", () => {
  const result = validateRuntimeConfig({
    NODE_ENV: "development",
    JWT_SECRET: "",
    MONGO_URI: "mongodb://example.test/db",
    AI_PROVIDER: "auto",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.includes("JWT_SECRET is required"), true);
});

test("validateRuntimeConfig warns when AI provider configuration is incomplete", () => {
  const warnings = buildRuntimeWarnings({
    JWT_SECRET: "secret",
    MONGO_URI: "mongodb://example.test/db",
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "",
  });

  assert.equal(warnings.some((item) => item.includes("OPENAI_API_KEY")), true);
});

test("buildHealthPayload returns readiness metadata", () => {
  const payload = buildHealthPayload({
    kind: "ready",
    dbReady: false,
    startedAt: "2026-03-30T00:00:00.000Z",
    warnings: ["Database degraded"],
    requestId: "req_123",
  });

  assert.equal(payload.kind, "ready");
  assert.equal(payload.status, "DEGRADED");
  assert.equal(payload.dbReady, false);
  assert.equal(payload.requestId, "req_123");
  assert.deepEqual(payload.warnings, ["Database degraded"]);
});
