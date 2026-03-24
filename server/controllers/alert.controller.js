const Alert = require("../models/Alert");

exports.getAlerts = async (req, res) => {
	try {
		if (!req.user?._id) return res.status(401).json({ success: false, msg: "Unauthorized" });

		const alerts = await Alert.find({ userId: req.user._id }).sort({ time: -1 });
		return res.json(alerts);
	} catch (err) {
		console.error("Get Alerts Error:", err);
		return res.status(500).json({ success: false, msg: "Server Error" });
	}
};

exports.updateAlert = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ success: false, msg: "Unauthorized" });

    const { id } = req.params;
    const { status, rootCause, recommendedAction, estimatedLoss } = req.body || {};

    const alert = await Alert.findOne({ _id: id, userId: req.user._id });
    if (!alert) return res.status(404).json({ success: false, msg: "Alert not found" });

    if (typeof rootCause === "string") alert.rootCause = rootCause.trim();
    if (typeof recommendedAction === "string") alert.recommendedAction = recommendedAction.trim();
    if (Number.isFinite(Number(estimatedLoss))) alert.estimatedLoss = Number(estimatedLoss);

    if (typeof status === "string") {
      const normalized = status.toUpperCase();
      const allowed = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"];
      if (!allowed.includes(normalized)) {
        return res.status(400).json({ success: false, msg: "Invalid status" });
      }
      alert.status = normalized;
      if (normalized === "ACKNOWLEDGED" && !alert.acknowledgedAt) alert.acknowledgedAt = new Date();
      if (normalized === "RESOLVED") alert.resolvedAt = new Date();
    }

    await alert.save();
    return res.json({ success: true, alert });
  } catch (err) {
    console.error("Update Alert Error:", err);
    return res.status(500).json({ success: false, msg: "Server Error" });
  }
};
