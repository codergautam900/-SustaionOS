const Data = require("../models/Data");
const detect = require("../services/detection.service").detect;
const alertService = require("../services/alert.service");
const ai = require("../ai/aiAnalyzer");
const scoreService = require("../services/sustainabilityScore.engine");

// SEND DATA
const sendData = async (req, res) => {
  try {
    if (!req.user?._id)
      return res.status(401).json({ success: false, msg: "Unauthorized" });

    const { building, water, energy } = req.body;

    if (!building || water == null || energy == null)
      return res.status(400).json({ success: false, msg: "All fields required" });

    const saved = await Data.create({
      userId: req.user._id,
      building,
      water: Number(water),
      energy: Number(energy),
      timestamp: new Date(), // ✅ force latest time
    });

    if (global.io) global.io.emit("newData", saved);

    return res.status(201).json({ success: true, data: saved });

  } catch (err) {
    console.error("Send Data Error:", err);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
};

// GET HISTORY (FIXED)
const getHistory = async (req, res) => {
  try {
    if (!req.user?._id)
      return res.status(401).json({ success: false, msg: "Unauthorized" });

    const history = await Data.find({ userId: req.user._id })
      .sort({ timestamp: -1 }) // ✅ FIXED
      .limit(100);

    res.json(history);
  } catch (err) {
    console.error("History Error:", err);
    res.status(500).json({ success: false, msg: "Failed to fetch history" });
  }
};

// GET SCORE (UNIFIED ENGINE)
const getScore = async (req, res) => {
  try {
    if (!req.user?._id)
      return res.status(401).json({ score: 0 });

    const result = await scoreService.calculateScore(req.user._id); // ✅ FIX

    res.json(result);
  } catch (err) {
    console.error("Score Error:", err);
    res.status(500).json({ score: 0 });
  }
};

module.exports = { sendData, getHistory, getScore };