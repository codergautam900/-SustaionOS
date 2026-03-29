const jwt = require("jsonwebtoken");

const User = require("../models/User");
const WorkspaceInvite = require("../models/WorkspaceInvite");
const { buildWorkspaceDefaults, normalizePlan, normalizeRole, normalizeStatus } = require("../services/accessControl.service");
const { recordAuditEvent } = require("../services/audit.service");
const { isInviteExpired } = require("../services/workspaceInvite.service");

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
    const { name, email, password, organizationName, inviteToken } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ msg: "User already exists" });
    }

    let invite = null;
    let inviter = null;
    if (inviteToken) {
      invite = await WorkspaceInvite.findOne({ token: String(inviteToken).trim() });
      if (!invite) {
        return res.status(400).json({ msg: "Invite token invalid" });
      }
      if (invite.status !== "PENDING" || isInviteExpired(invite)) {
        return res.status(400).json({ msg: "Invite expired or already used" });
      }
      if (String(invite.invitedEmail || "").trim().toLowerCase() !== normalizedEmail) {
        return res.status(400).json({ msg: "Invite email does not match the registering account" });
      }
      inviter = await User.findById(invite.invitedBy).select("-password");
      if (!inviter) {
        return res.status(400).json({ msg: "Invite owner not found" });
      }
    }

    const workspaceDefaults = invite
      ? {
          organizationName: inviter.organizationName || invite.organizationName || "SustainOS Workspace",
          organizationSlug: inviter.organizationSlug || invite.organizationSlug,
          teamName: inviter.teamName || "Operations",
          industry: inviter.industry || "Smart Buildings",
          timezone: inviter.timezone || "Asia/Kolkata",
          plan: inviter.plan || "STARTER",
          role: invite.role || "ANALYST",
          status: "ACTIVE",
          apiAccessEnabled: inviter.apiAccessEnabled !== false,
          mfaEnabled: false,
          dataRetentionDays: inviter.dataRetentionDays || 365,
          lastLoginAt: null,
        }
      : buildWorkspaceDefaults({ name, email: normalizedEmail, organizationName });

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      ...workspaceDefaults,
      organizationName: invite
        ? inviter.organizationName || invite.organizationName || workspaceDefaults.organizationName
        : organizationName
            ? String(organizationName).trim().slice(0, 80)
            : workspaceDefaults.organizationName,
    });

    if (invite) {
      invite.status = "ACCEPTED";
      invite.acceptedBy = user._id;
      invite.acceptedAt = new Date();
      await invite.save();
    }

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
        inviteAccepted: Boolean(invite),
      },
      req,
    });

    if (invite) {
      await recordAuditEvent({
        userId: inviter._id,
        actor: user,
        action: "workspace.invite.accepted",
        category: "workspace",
        severity: "INFO",
        targetType: "invite",
        targetId: String(invite._id),
        metadata: {
          invitedEmail: invite.invitedEmail,
          role: invite.role,
        },
        req,
      });
    }

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
