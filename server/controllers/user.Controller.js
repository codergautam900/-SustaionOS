const User = require("../models/User");
const Data = require("../models/Data");
const scoreService = require("../services/sustainabilityScore.engine");
const { buildOrganizationSlug, normalizePlan, normalizeRole, normalizeStatus } = require("../services/accessControl.service");
const { recordAuditEvent } = require("../services/audit.service");

const cleanText = (value, max = 80) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const buildUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  building: user.building || "",
  role: normalizeRole(user.role),
  organizationName: user.organizationName || "",
  organizationSlug: user.organizationSlug || "",
  teamName: user.teamName || "Operations",
  industry: user.industry || "Smart Buildings",
  timezone: user.timezone || "Asia/Kolkata",
  plan: normalizePlan(user.plan),
  status: normalizeStatus(user.status),
  apiAccessEnabled: Boolean(user.apiAccessEnabled),
  mfaEnabled: Boolean(user.mfaEnabled),
  dataRetentionDays: Number(user.dataRetentionDays || 365),
  lastLoginAt: user.lastLoginAt || null,
});

exports.getProfile = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    return res.json({
      success: true,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error("Get Profile Error:", err);
    return res.status(500).json({
      success: false,
      msg: "Failed to fetch profile",
    });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    const records = await Data.find({ userId: req.user._id }).sort({ timestamp: -1, createdAt: -1 }).limit(180);
    const totalEnergy = records.reduce((sum, item) => sum + Number(item.energy || 0), 0);
    const totalWater = records.reduce((sum, item) => sum + Number(item.water || 0), 0);
    const avgEnergy = records.length ? Math.round(totalEnergy / records.length) : 0;
    const avgWater = records.length ? Math.round(totalWater / records.length) : 0;
    const score = await scoreService.calculateScore(req.user._id);

    return res.json({
      success: true,
      totalEnergy,
      totalWater,
      score: score?.score ?? 0,
      avgEnergy,
      avgWater,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error("Stats Error:", err);
    return res.status(500).json({
      success: false,
      msg: "Failed to fetch stats",
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const {
      name,
      building,
      organizationName,
      teamName,
      industry,
      timezone,
      apiAccessEnabled,
      mfaEnabled,
      dataRetentionDays,
    } = req.body || {};

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (typeof name === "string" && cleanText(name, 60)) user.name = cleanText(name, 60);
    if (typeof building === "string") user.building = cleanText(building, 80);

    if (typeof organizationName === "string" && cleanText(organizationName, 80)) {
      const previousOrg = String(user.organizationName || "");
      const nextOrg = cleanText(organizationName, 80);
      user.organizationName = nextOrg;
      if (!user.organizationSlug || nextOrg.toLowerCase() !== previousOrg.toLowerCase()) {
        user.organizationSlug = buildOrganizationSlug(nextOrg);
      }
    }

    if (typeof teamName === "string" && cleanText(teamName, 80)) user.teamName = cleanText(teamName, 80);
    if (typeof industry === "string" && cleanText(industry, 80)) user.industry = cleanText(industry, 80);
    if (typeof timezone === "string" && cleanText(timezone, 60)) user.timezone = cleanText(timezone, 60);
    if (typeof apiAccessEnabled === "boolean") user.apiAccessEnabled = apiAccessEnabled;
    if (typeof mfaEnabled === "boolean") user.mfaEnabled = mfaEnabled;
    if (dataRetentionDays != null && Number.isFinite(Number(dataRetentionDays))) {
      user.dataRetentionDays = Math.max(30, Math.min(3650, Number(dataRetentionDays)));
    }

    await user.save();

    await recordAuditEvent({
      userId: user._id,
      actor: req.user,
      action: "user.profile.updated",
      category: "workspace",
      severity: "INFO",
      targetType: "user",
      targetId: String(user._id),
      metadata: {
        building: user.building,
        organizationName: user.organizationName,
        apiAccessEnabled: user.apiAccessEnabled,
        mfaEnabled: user.mfaEnabled,
      },
      req,
    });

    return res.json({
      success: true,
      msg: "Profile updated successfully",
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({
      success: false,
      msg: "Failed to update profile",
    });
  }
};
