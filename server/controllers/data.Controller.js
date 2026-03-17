const Data = require("../models/Data");
const detect = require("../services/detection.service").detect;
const alertService = require("../services/alert.service");
const ai = require("../ai/aiAnalyzer");

exports.sendData = async (req, res, next) => {
  try {
    const { building, water, energy } = req.body;

    // ✅ Validation
    if (!building || water == null || energy == null) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // ✅ Save Data
    const saved = await Data.create({
      building,
      water: Number(water),
      energy: Number(energy),
    });

    // ✅ Realtime emit (if socket exists)
    if (global.io) {
      global.io.emit("newData", saved);
    }

    let aiResult = null;
    let anomaly = null;

    try {
      anomaly = detect(Number(water), Number(energy));

      if (anomaly?.status) {

        // ✅ ALERT SAVE (FIXED)
        await alertService.createAlert({
          userId: req.user?.id || "67a123456789fakeuserid", // temp safe fallback
          building,
          message: anomaly.reason,
          severity: (anomaly.severity || "LOW").toUpperCase(),
        });

        // ✅ AI ANALYSIS SAFE
        try {
          aiResult = ai.analyze(anomaly.reason);
        } catch (e) {
          console.log("AI Error:", e.message);
        }

        // ✅ Realtime alert
        if (global.io) {
          global.io.emit("newAlert", {
            building,
            message: anomaly.reason,
            severity: anomaly.severity,
          });
        }
      }

    } catch (e) {
      console.log("Detection Error:", e.message);
    }

    res.status(201).json({
      success: true,
      data: saved,
      anomaly,
      ai: aiResult,
    });

  } catch (err) {
    console.error("❌ Data Controller Error:", err);
    res.status(500).json({
      success: false,
      msg: "Server Error",
      error: err.message
    });
  }
};


exports.getHistory = async (req, res, next) => {
  try {
    const history = await Data.find()
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(history);
  } catch (err) {
    console.error("❌ History Error:", err);
    res.status(500).json({ msg: "Failed to fetch history" });
  }
};