const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: String,
  severity: { type: String, enum: ["LOW","MEDIUM","HIGH","CRITICAL"], default: "LOW" },
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Alert", alertSchema);