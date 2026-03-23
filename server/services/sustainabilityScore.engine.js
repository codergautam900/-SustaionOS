const Data = require("../models/Data");
const Alert = require("../models/Alert");

exports.calculateScore = async (userId) => {
  try {
    if (!userId) return { score: 0, status: "No User" };

    // ✅ FIX 1: correct sorting field
    const latest = await Data.findOne({ userId }).sort({ timestamp: -1 });

    // ✅ FIX 2: user-based aggregation
    const stats = await Data.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          avgWater: { $avg: "$water" },
          avgEnergy: { $avg: "$energy" },
          maxWater: { $max: "$water" },
          maxEnergy: { $max: "$energy" },
        },
      },
    ]);

    // ✅ FIX 3: user alerts only
    const alertCount = await Alert.countDocuments({ userId });

    if (!latest || !stats[0])
      return { score: 0, status: "No Data" };

    const avgWater = stats[0].avgWater || 1;
    const avgEnergy = stats[0].avgEnergy || 1;
    const maxWater = stats[0].maxWater || latest.water;
    const maxEnergy = stats[0].maxEnergy || latest.energy;

    let penalty = 0;

    // WATER
    const waterRatio = latest.water / avgWater;
    if (waterRatio > 1)
      penalty += Math.min((waterRatio - 1) * 50, 40);

    // ENERGY
    const energyRatio = latest.energy / avgEnergy;
    if (energyRatio > 1)
      penalty += Math.min((energyRatio - 1) * 50, 40);

    // ALERTS
    penalty += Math.min(alertCount * 4, 20);

    // SPIKE
    if (latest.water >= maxWater * 0.95) penalty += 10;
    if (latest.energy >= maxEnergy * 0.95) penalty += 10;

    // FINAL SCORE
    let score = Math.max(0, Math.round(100 - penalty));

    // STATUS
    let status = "Excellent";
    let riskLevel = "LOW";

    if (score < 85) { status = "Good"; riskLevel = "MEDIUM"; }
    if (score < 65) { status = "Moderate"; riskLevel = "HIGH"; }
    if (score < 45) { status = "Critical"; riskLevel = "SEVERE"; }

    // MESSAGE
    let message = "All systems optimal.";
    if (riskLevel === "MEDIUM") message = "Minor inefficiencies detected.";
    if (riskLevel === "HIGH") message = "Resource usage above optimal range.";
    if (riskLevel === "SEVERE") message = "Immediate optimization required.";

    return {
      score,
      status,
      risk: riskLevel,
      alerts: alertCount,
      usage: {
        water: latest.water,
        energy: latest.energy,
      },
      message,
    };

  } catch (err) {
    console.error("Error calculating score:", err);
    return {
      score: 0,
      status: "Error",
      risk: "UNKNOWN",
      alerts: 0,
      usage: { water: 0, energy: 0 },
      message: "Failed to calculate",
    };
  }
};