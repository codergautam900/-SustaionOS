const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "" },
    actorEmail: { type: String, default: "" },
    category: { type: String, default: "platform" },
    action: { type: String, required: true },
    severity: { type: String, enum: ["INFO", "WARN", "HIGH"], default: "INFO" },
    status: { type: String, enum: ["SUCCESS", "FAILED"], default: "SUCCESS" },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, category: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
