const test = require("node:test");
const assert = require("node:assert/strict");

const { predictNext } = require("../services/prediction.service");

test("predictNext fallback returns advanced forecast payload for descending telemetry", async () => {
  const base = new Date("2026-03-28T00:00:00.000Z").getTime();
  const records = new Array(18).fill(null).map((_, index) => ({
    timestamp: new Date(base + index * 60 * 60 * 1000).toISOString(),
    energy: 120 + index * 6,
    water: 90 + index * 4,
  })).reverse();

  const prediction = await predictNext(records);

  assert.ok(prediction);
  assert.equal(Array.isArray(prediction.forecastPath), true);
  assert.equal(prediction.forecastPath.length, 24);
  assert.equal(Array.isArray(prediction.drivers), true);
  assert.ok(prediction.predictedEnergyNextHour > 0);
  assert.ok(prediction.predictedWaterNextHour > 0);
  assert.ok(prediction.predictedEnergyCI95);
  assert.ok(prediction.predictedWaterCI95);
  assert.ok(prediction.training);
  assert.ok(prediction.modelOps);
  assert.equal(typeof prediction.confidence, "number");
});
