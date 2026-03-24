const Data = require("../models/Data");
const Alert = require("../models/Alert");
const executiveInsights = require("./executiveInsights.service");

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

exports.generateReportData = async (userId = null) => {
  const dataFilter = userId ? { userId } : {};
  const alertFilter = userId ? { userId } : {};
  const data = await Data.find(dataFilter).sort({ timestamp: 1 });
  const alerts = await Alert.find(alertFilter).sort({ time: -1 });

  const totalWater = data.reduce((a, b) => a + toNumber(b.water), 0);
  const totalEnergy = data.reduce((a, b) => a + toNumber(b.energy), 0);
  const carbon = Math.round(totalEnergy * 0.82);
  const cost = Math.round(totalEnergy * 8 + totalWater * 0.02);

  const buildingSummary = data.reduce((acc, item) => {
    const key = item.building || "Unknown";
    if (!acc[key]) acc[key] = { energy: 0, water: 0, count: 0, locations: new Set() };
    acc[key].energy += toNumber(item.energy);
    acc[key].water += toNumber(item.water);
    acc[key].count += 1;
    if (item.location) acc[key].locations.add(item.location);
    return acc;
  }, {});

  const topBuildingEntry = Object.entries(buildingSummary).sort(
    (a, b) => b[1].energy + b[1].water - (a[1].energy + a[1].water)
  )[0];

  const monthly = [];
  const monthMap = {};
  data.forEach((item) => {
    const ts = new Date(item.timestamp || item.createdAt || Date.now());
    const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[monthKey]) monthMap[monthKey] = { energy: 0, water: 0, count: 0 };
    monthMap[monthKey].energy += toNumber(item.energy);
    monthMap[monthKey].water += toNumber(item.water);
    monthMap[monthKey].count += 1;
  });

  Object.keys(monthMap)
    .sort()
    .slice(-6)
    .forEach((monthKey) => {
      const bucket = monthMap[monthKey];
      const total = bucket.energy + bucket.water;
      const efficiency = total
        ? Math.max(
            0,
            Math.round(100 - bucket.energy / Math.max(1, bucket.count) / 10 - bucket.water / Math.max(1, bucket.count) / 50)
          )
        : 100;
      monthly.push({ month: monthKey, efficiency });
    });

  const insights = userId ? await executiveInsights.getExecutiveInsights(userId, "month") : null;

  const recommendation = insights
    ? `${insights.nextBestAction} Highest priority: ${insights.priorityActions?.[0]?.title || "Continue monitoring"}`
    : "Add user-scoped telemetry to unlock executive recommendations.";

  return {
    totalWater,
    totalEnergy,
    alerts: alerts.length,
    cost,
    carbon,
    monthly,
    recommendation,
    topBuilding: topBuildingEntry
      ? {
          building: topBuildingEntry[0],
          energy: topBuildingEntry[1].energy,
          water: topBuildingEntry[1].water,
          locations: Array.from(topBuildingEntry[1].locations || []),
        }
      : null,
    insights,
  };
};
