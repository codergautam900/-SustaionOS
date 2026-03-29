const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildApiKeyPublicView,
  buildApiKeySecret,
  hashApiKey,
  normalizeScopes,
} = require("../services/apiKey.service");

test("buildApiKeySecret creates hashable workspace key metadata", () => {
  const payload = buildApiKeySecret();

  assert.equal(payload.secret.startsWith("sos_live_"), true);
  assert.equal(payload.hash, hashApiKey(payload.secret));
  assert.equal(payload.lastFour.length, 4);
  assert.equal(typeof payload.prefix, "string");
});

test("normalizeScopes keeps only supported SaaS scopes", () => {
  const scopes = normalizeScopes(["ingest:telemetry", "bad:scope", "analytics:read"]);
  assert.deepEqual(scopes, ["ingest:telemetry", "analytics:read"]);
});

test("buildApiKeyPublicView strips secret material", () => {
  const view = buildApiKeyPublicView({
    _id: "123",
    label: "Primary gateway",
    prefix: "sos_live_abcd",
    lastFour: "1234",
    status: "ACTIVE",
    scopes: ["ingest:telemetry"],
    hash: "hidden",
  });

  assert.equal(view.label, "Primary gateway");
  assert.equal("hash" in view, false);
});
