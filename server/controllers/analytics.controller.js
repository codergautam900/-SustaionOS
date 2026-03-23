// ...existing code...
const Data = require("../models/Data"); // MongoDB model
const scoreService = require("../services/sustainabilityScore.engine");

// Get analytics summary
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period } = req.query;
    let startDate = null;
    const now = new Date();

    // Support: week, month, numeric months (e.g. 6,12), "year"
    if (period === "week") {
      startDate = new Date();
      startDate.setDate(now.getDate() - 6);
    } else if (period === "month") {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === "year") {
      startDate = new Date();
      startDate.setFullYear(now.getFullYear() - 1);
    } else if (!isNaN(parseInt(period))) {
      // treat numeric value as months
      startDate = new Date();
      startDate.setMonth(now.getMonth() - parseInt(period));
    }

    const filter = startDate ? { timestamp: { $gte: startDate } } : {};
    const records = await Data.find(filter);

    if (!records.length) {
      return res.json({ totalRecords: 0, totalWater: 0, totalEnergy: 0, avgWater: 0, avgEnergy: 0 });
    }

    const totalWater = records.reduce((a, b) => a + (b.water || 0), 0);
    const totalEnergy = records.reduce((a, b) => a + (b.energy || 0), 0);
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
      const day = r.timestamp instanceof Date
        ? r.timestamp.toISOString().split("T")[0]
        : new Date(r.timestamp).toISOString().split("T")[0];
      if (!trendMap[day]) trendMap[day] = { energy: 0, water: 0 };
      trendMap[day].energy += Number(r.energy || 0);
      trendMap[day].water += Number(r.water || 0);
    });

    const trend = Object.keys(trendMap)
      .sort()
      .map((day) => {
        const dt = new Date(day);
        return {
          date: day, // YYYY-MM-DD (client accepts)
          label: dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), // friendly label
          time: dt.getTime(), // numeric timestamp
          ...trendMap[day],
        };
      });
    res.json(trend);
  } catch (err) {
    next(err);
  }
};