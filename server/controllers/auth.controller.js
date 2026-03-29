const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { buildWorkspaceDefaults, normalizePlan, normalizeRole, normalizeStatus } = require("../services/accessControl.service");
const { recordAuditEvent } = require("../services/audit.service");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in environment variables");
}

const generateToken = (userId) =>
  jwt.sign(
    { _id: userId },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

const buildUserPayload = (user) => ({
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

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, organizationName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const workspaceDefaults = buildWorkspaceDefaults({ name, email, organizationName });
    const user = await User.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password,
      ...workspaceDefaults,
      organizationName: organizationName ? String(organizationName).trim().slice(0, 80) : workspaceDefaults.organizationName,
    });

    const token = generateToken(user._id);

    await recordAuditEvent({
      userId: user._id,
      actor: user,
      action: "auth.register",
      category: "auth",
      severity: "INFO",
      targetType: "user",
      targetId: String(user._id),
      metadata: {
        organizationName: user.organizationName,
        plan: user.plan,
      },
      req,
    });

    res.status(201).json({
      success: true,
      token,
      user: buildUserPayload(user),
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password required" });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });

    if (!user) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    const match = await user.comparePassword(password);

    if (!match) {
      await recordAuditEvent({
        userId: user._id,
        actor: user,
        action: "auth.login",
        category: "auth",
        severity: "WARN",
        status: "FAILED",
        targetType: "user",
        targetId: String(user._id),
        metadata: { reason: "invalid-password" },
        req,
      });
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id);

    await recordAuditEvent({
      userId: user._id,
      actor: user,
      action: "auth.login",
      category: "auth",
      severity: "INFO",
      targetType: "user",
      targetId: String(user._id),
      metadata: { role: normalizeRole(user.role), plan: normalizePlan(user.plan) },
      req,
    });

    res.json({
      success: true,
      token,
      user: buildUserPayload(user),
    });
  } catch (err) {
    next(err);
  }
};

exports.buildUserPayload = buildUserPayload;
