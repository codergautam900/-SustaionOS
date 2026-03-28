const mlBridge = require("./mlBridge.service");

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mean = (values = []) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + toNumber(value), 0) / values.length;
};

const stddev = (values = []) => {
  if (!values.length) return 0;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (toNumber(value) - center) ** 2, 0) / values.length);
};

const ema = (values = [], alpha = 0.38) => {
  if (!values.length) return 0;
  let current = toNumber(values[0]);
  for (let index = 1; index < values.length; index += 1) {
    current = alpha * toNumber(values[index]) + (1 - alpha) * current;
  }
  return current;
};

const normalizeRecords = (records = []) =>
  (Array.isArray(records) ? records : [])
    .map((record) => ({
      timestamp: record.timestamp || record.createdAt || null,
      water: toNumber(record.water),
      energy: toNumber(record.energy),
    }))
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

const getHourOfWeek = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay() * 24 + date.getHours();
};

const linearPredict = (series = []) => {
  if (series.length < 2) return null;

  const times = series.map((point) => {
    const time = point.timestamp ? Number(new Date(point.timestamp)) : null;
    return Number.isFinite(time) ? time : null;
  });

  if (times.some((time) => time == null)) return null;

  const t0 = times[0];
  const xs = times.map((time) => time - t0);
  const ys = series.map((point) => toNumber(point.value));
  const n = xs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let index = 0; index < n; index += 1) {
    sumX += xs[index];
    sumY += ys[index];
    sumXY += xs[index] * ys[index];
    sumXX += xs[index] * xs[index];
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const lastX = xs[xs.length - 1];
  const oneHour = 1000 * 60 * 60;

  return {
    predictAt(delta) {
      return intercept + slope * (lastX + delta);
    },
  };
};

const buildSeasonalMeans = (records, metric) => {
  const buckets = new Array(24 * 7).fill(0).map(() => ({ sum: 0, count: 0 }));
  records.forEach((record) => {
    const index = getHourOfWeek(record.timestamp);
    if (index == null) return;
    buckets[index].sum += toNumber(record[metric]);
    buckets[index].count += 1;
  });
  return buckets.map((bucket) => (bucket.count ? bucket.sum / bucket.count : null));
};

const fallbackPredictNext = (records) => {
  const ordered = normalizeRecords(records);
  if (!ordered.length) return null;

  const energyValues = ordered.map((record) => toNumber(record.energy));
  const waterValues = ordered.map((record) => toNumber(record.water));
  const avgEnergy = mean(energyValues);
  const avgWater = mean(waterValues);
  const latestTimestamp = ordered[ordered.length - 1]?.timestamp
    ? Number(new Date(ordered[ordered.length - 1].timestamp))
    : Date.now();

  const energySeries = ordered.map((record) => ({ timestamp: record.timestamp, value: record.energy }));
  const waterSeries = ordered.map((record) => ({ timestamp: record.timestamp, value: record.water }));
  const energyTrend = linearPredict(energySeries);
  const waterTrend = linearPredict(waterSeries);
  const seasonalEnergy = buildSeasonalMeans(ordered, "energy");
  const seasonalWater = buildSeasonalMeans(ordered, "water");
  const weights = { model: 0.35, seasonal: 0.4, momentum: 0.25 };
  const energyStd = Math.max(1, Math.round(stddev(energyValues)));
  const waterStd = Math.max(1, Math.round(stddev(waterValues)));
  const oneHour = 1000 * 60 * 60;

  const path = [];
  const rollingEnergy = [...energyValues.slice(-8)];
  const rollingWater = [...waterValues.slice(-8)];

  for (let step = 1; step <= 24; step += 1) {
    const targetTimestamp = latestTimestamp + oneHour * step;
    const seasonalIndex = getHourOfWeek(targetTimestamp);
    const seasonalEnergyPoint = seasonalIndex != null && seasonalEnergy[seasonalIndex] != null ? seasonalEnergy[seasonalIndex] : avgEnergy;
    const seasonalWaterPoint = seasonalIndex != null && seasonalWater[seasonalIndex] != null ? seasonalWater[seasonalIndex] : avgWater;
    const modelEnergy = energyTrend ? energyTrend.predictAt(oneHour * step) : avgEnergy;
    const modelWater = waterTrend ? waterTrend.predictAt(oneHour * step) : avgWater;
    const energyDelta = rollingEnergy.length >= 2 ? rollingEnergy[rollingEnergy.length - 1] - rollingEnergy[rollingEnergy.length - 2] : 0;
    const waterDelta = rollingWater.length >= 2 ? rollingWater[rollingWater.length - 1] - rollingWater[rollingWater.length - 2] : 0;
    const momentumEnergy = ema(rollingEnergy) + energyDelta * 0.85;
    const momentumWater = ema(rollingWater) + waterDelta * 0.85;

    const predictedEnergy = Math.max(
      0,
      modelEnergy * weights.model + seasonalEnergyPoint * weights.seasonal + momentumEnergy * weights.momentum
    );
    const predictedWater = Math.max(
      0,
      modelWater * weights.model + seasonalWaterPoint * weights.seasonal + momentumWater * weights.momentum
    );
    const predictedScore = Math.max(0, Math.min(100, 100 - predictedEnergy / 15 - predictedWater / 120));

    path.push({
      timestamp: new Date(targetTimestamp).toISOString(),
      predictedEnergy: Math.round(predictedEnergy),
      predictedWater: Math.round(predictedWater),
      predictedScore: Math.round(predictedScore),
      energyBand: {
        low: Math.max(0, Math.round(predictedEnergy - 1.96 * energyStd)),
        high: Math.round(predictedEnergy + 1.96 * energyStd),
      },
      waterBand: {
        low: Math.max(0, Math.round(predictedWater - 1.96 * waterStd)),
        high: Math.round(predictedWater + 1.96 * waterStd),
      },
    });

    rollingEnergy.push(predictedEnergy);
    rollingWater.push(predictedWater);
    if (rollingEnergy.length > 8) rollingEnergy.shift();
    if (rollingWater.length > 8) rollingWater.shift();
  }

  const nextHour = path[0];
  const nextDay = path[path.length - 1];
  const offHoursRatio =
    (ordered.filter((record) => {
      const hour = new Date(record.timestamp || 0).getHours();
      const day = new Date(record.timestamp || 0).getDay();
      return day === 0 || day === 6 || hour < 7 || hour >= 20;
    }).length /
      Math.max(1, ordered.length)) *
    100;

  return {
    model: {
      name: "sustainos-js-ensemble",
      version: "3.0.0",
      source: "js-fallback",
      label: "JS Ensemble Fallback",
      active: false,
      trainedSamples: ordered.length,
      fitScore: 54,
    },
    predictedWaterAvg: Math.round(avgWater),
    predictedEnergyAvg: Math.round(avgEnergy),
    predictedWaterNextHour: nextHour?.predictedWater ?? Math.round(avgWater),
    predictedEnergyNextHour: nextHour?.predictedEnergy ?? Math.round(avgEnergy),
    predictedWaterNextDay: nextDay?.predictedWater ?? Math.round(avgWater),
    predictedEnergyNextDay: nextDay?.predictedEnergy ?? Math.round(avgEnergy),
    predictedEnergyStdDev: energyStd,
    predictedWaterStdDev: waterStd,
    predictedEnergyCI95: nextHour?.energyBand || { low: Math.round(avgEnergy - 1.96 * energyStd), high: Math.round(avgEnergy + 1.96 * energyStd) },
    predictedWaterCI95: nextHour?.waterBand || { low: Math.round(avgWater - 1.96 * waterStd), high: Math.round(avgWater + 1.96 * waterStd) },
    confidence: 56,
    signalBreakdown: {
      energyTrend: Number(((energyValues.at(-1) - energyValues[0]) / Math.max(1, energyValues[0]) * 100).toFixed(2)),
      waterTrend: Number(((waterValues.at(-1) - waterValues[0]) / Math.max(1, waterValues[0]) * 100).toFixed(2)),
      offHoursRatio: Number(offHoursRatio.toFixed(2)),
      usageConsistency: Math.max(30, Math.round(100 - stddev([...energyValues, ...waterValues]) * 0.15)),
    },
    latest: {
      energy: energyValues.at(-1) ?? 0,
      water: waterValues.at(-1) ?? 0,
    },
    forecastPath: path,
    path,
    drivers: [
      { label: "Energy trend", value: Number(((energyValues.at(-1) - energyValues[0]) / Math.max(1, energyValues[0]) * 100).toFixed(2)), unit: "%" },
      { label: "Water trend", value: Number(((waterValues.at(-1) - waterValues[0]) / Math.max(1, waterValues[0]) * 100).toFixed(2)), unit: "%" },
      { label: "After-hours share", value: Number(offHoursRatio.toFixed(2)), unit: "%" },
    ],
    componentWeights: weights,
    predictionWindows: {
      nextHour,
      nextDay,
    },
    training: {
      samples: ordered.length,
      featureCount: 8,
      metrics: {},
      validationMetrics: {},
    },
    modelOps: {
      ensembleMode: "hybrid-linear-seasonal-momentum",
      avgGapHours: 1,
    },
  };
};

exports.predictNext = async (records) => {
  const simplified = normalizeRecords(records);

  try {
    const remote = await mlBridge.postJson("/predict", { records: simplified });
    if (remote?.prediction) return remote.prediction;
    if (remote?.predictions) return remote.predictions;
  } catch (err) {
    console.error("Python ML prediction unavailable, using local fallback:", err.message || err);
  }

  return fallbackPredictNext(simplified);
};
