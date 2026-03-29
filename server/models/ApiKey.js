const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true },
    hash: { type: String, required: true },
    prefix: { type: String, required: true },
    lastFour: { type: String, required: true },
    scopes: { type: [String], default: ["ingest:telemetry"] },
    status: { type: String, enum: ["ACTIVE", "REVOKED", "EXPIRED"], default: "ACTIVE" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    lastUsedFromIp: { type: String, default: "" },
  },
  { timestamps: true }
);

apiKeySchema.index({ userId: 1, status: 1, createdAt: -1 });
apiKeySchema.index({ hash: 1 }, { unique: true });

module.exports = mongoose.model("ApiKey", apiKeySchema);
