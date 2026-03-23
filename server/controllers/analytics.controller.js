// controllers/analytics.controller.js
const Data = require("../models/Data"); // MongoDB model
const scoreService = require("../services/sustainabilityScore.engine");

// Get analytics summary
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period } = req.query;
    let startDate;
    if (period === "week") {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
    } else if (period === "month") {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const filter = startDate ? { timestamp: { $gte: startDate } } : {};
    const records = await Data.find(filter);

    if (!records.length) return res.json({ msg: "No data available" });

    const totalWater = records.reduce((a, b) => a + b.water, 0);
    const totalEnergy = records.reduce((a, b) => a + b.energy, 0);
    const avgWater = Math.round(totalWater / records.length);
    const avgEnergy = Math.round(totalEnergy / records.length);

    res.json({ totalRecords: records.length, totalWater, totalEnergy, avgWater, avgEnergy });
  } catch (err) {
    next(err);
  }
};

// Get sustainability score
exports.getScore = async (req, res, next) => {
  try {
    const result = await scoreService.calculateScore();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Get history
exports.getHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const records = await Data.find().sort({ timestamp: -1 }).limit(limit);
    res.json(records.reverse()); // oldest first
  } catch (err) {
    next(err);
  }
};

// Get trend for charts
exports.getTrend = async (req, res, next) => {
  try {
    const records = await Data.find().sort({ timestamp: 1 });
    if (!records.length) return res.json([]);

    const trendMap = {};
    records.forEach((r) => {
      const day = r.timestamp.toISOString().split("T")[0];
      if (!trendMap[day]) trendMap[day] = { energy: 0, water: 0 };
      trendMap[day].energy += r.energy;
      trendMap[day].water += r.water;
    });

    const trend = Object.keys(trendMap)
      .sort()
      .map((day) => ({ date: day, ...trendMap[day] }));
    res.json(trend);
  } catch (err) {
    next(err);
  }
};