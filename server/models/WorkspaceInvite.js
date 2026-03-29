const mongoose = require("mongoose");

const workspaceInviteSchema = new mongoose.Schema(
  {
    organizationSlug: { type: String, required: true, index: true },
    organizationName: { type: String, default: "" },
    invitedEmail: { type: String, required: true, index: true },
    role: { type: String, default: "ANALYST" },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"], default: "PENDING" },
    token: { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    acceptedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    message: { type: String, default: "" },
  },
  { timestamps: true }
);

workspaceInviteSchema.index({ organizationSlug: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("WorkspaceInvite", workspaceInviteSchema);
