const Alert = require("../models/Alert");

exports.createAlert = async ({
  userId,
  building,
  message,
  severity,
  status = "OPEN",
  rootCause = "",
  estimatedLoss = 0,
  recommendedAction = "",
}) => {
  try {
    const alert = await Alert.create({
      userId,
      building,
      message,
      severity,
      status,
      rootCause,
      estimatedLoss,
      recommendedAction,
    });

    return alert;

  } catch (err) {
    console.error("❌ Alert Service Error:", err.message);
    return null; // crash रोकने के लिए
  }
};
