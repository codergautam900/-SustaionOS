const User = require("../models/User");
const ApiKey = require("../models/ApiKey");
const AuditLog = require("../models/AuditLog");
const WorkspaceInvite = require("../models/WorkspaceInvite");
const { buildInviteToken, buildInviteResponse, isInviteExpired } = require("../services/workspaceInvite.service");
const { createApiKey, buildApiKeyPublicView, normalizeScopes } = require("../services/apiKey.service");
const { recordAuditEvent, buildAuditResponse } = require("../services/audit.service");
const { getPlanLimits, normalizePlan, normalizeRole, normalizeStatus } = require("../services/accessControl.service");
const platformService = require("../services/platform.service");

const getWorkspaceQuery = (user = {}) =>
  user?.organizationSlug ? { organizationSlug: user.organizationSlug } : { _id: user?._id };

const getWorkspaceMembers = async (user) =>
  User.find(getWorkspaceQuery(user)).select("-password").sort({ createdAt: 1 });

const getWorkspaceUsersForKeyOps = async (user) =>
  User.find(getWorkspaceQuery(user)).select("_id name email").lean();

const buildMemberView = (member) => ({
  _id: member._id,
  name: member.name,
  email: member.email,
  role: normalizeRole(member.role),
  status: normalizeStatus(member.status),
  lastLoginAt: member.lastLoginAt || null,
});

const buildApiKeyViewWithOwner = (apiKey, ownerMap = new Map()) => {
  const view = buildApiKeyPublicView(apiKey);
  const ownerId = String(apiKey.userId?._id || apiKey.userId || "");
  const owner = ownerMap.get(ownerId);

  return {
    ...view,
    ownerId,
    ownerName: owner?.name || apiKey.userId?.name || "",
    ownerEmail: owner?.email || apiKey.userId?.email || "",
  };
};

const getWorkspacePendingInvites = async (user) => {
  if (!user?.organizationSlug) return [];
  const invites = await WorkspaceInvite.find({
    organizationSlug: user.organizationSlug,
    status: "PENDING",
  }).sort({ createdAt: -1 });

  return invites.filter((invite) => !isInviteExpired(invite));
};

exports.getOverview = async (req, res, next) => {
  try {
    const overview = await platformService.getPlatformOverview(req.user);
    res.json(overview);
  } catch (err) {
    next(err);
  }
};

exports.getTeam = async (req, res, next) => {
  try {
    const members = await getWorkspaceMembers(req.user);
    const invites = await getWorkspacePendingInvites(req.user);

    res.json({
      success: true,
      members: members.map((member) => buildMemberView(member)),
      invites: invites.map((invite) => buildInviteResponse(invite)),
    });
  } catch (err) {
    next(err);
  }
};

exports.createInvite = async (req, res, next) => {
  try {
    if (!req.user?.organizationSlug) {
      return res.status(400).json({ success: false, msg: "Workspace setup incomplete. Add an organization name first." });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = normalizeRole(req.body?.role || "ANALYST");
    const message = String(req.body?.message || "").trim().slice(0, 240);
    const expiresInDays = Math.min(30, Math.max(1, Number(req.body?.expiresInDays) || 7));

    if (!email) {
      return res.status(400).json({ success: false, msg: "Invite email required" });
    }

    const [members, activeInvites] = await Promise.all([
      User.find(getWorkspaceQuery(req.user)).select("_id"),
      getWorkspacePendingInvites(req.user),
    ]);
    const limits = getPlanLimits(req.user.plan);
    if (members.length + activeInvites.length >= limits.members) {
      return res.status(400).json({
        success: false,
        msg: `Member limit reached for the ${normalizePlan(req.user.plan)} plan`,
      });
    }

    const existingMember = await User.findOne({ email, organizationSlug: req.user.organizationSlug });
    if (existingMember) {
      return res.status(400).json({ success: false, msg: "This email is already a workspace member" });
    }

    const existingInvite = activeInvites.find((invite) => invite.invitedEmail === email);
    if (existingInvite) {
      return res.status(400).json({ success: false, msg: "A pending invite already exists for this email" });
    }

    const invite = await WorkspaceInvite.create({
      organizationSlug: req.user.organizationSlug,
      organizationName: req.user.organizationName,
      invitedEmail: email,
      role,
      token: buildInviteToken(),
      invitedBy: req.user._id,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      message,
    });

    await recordAuditEvent({
      userId: req.user._id,
      actor: req.user,
      action: "workspace.invite.created",
      category: "workspace",
      severity: "HIGH",
      targetType: "invite",
      targetId: String(invite._id),
      metadata: { invitedEmail: email, role },
      req,
    });

    res.status(201).json({
      success: true,
      invite: buildInviteResponse(invite),
      inviteLink: `/register?inviteToken=${invite.token}`,
    });
  } catch (err) {
    next(err);
  }
};

exports.revokeInvite = async (req, res, next) => {
  try {
    const invite = await WorkspaceInvite.findOne({
      _id: req.params.id,
      organizationSlug: req.user.organizationSlug,
    });
    if (!invite) return res.status(404).json({ success: false, msg: "Invite not found" });

    invite.status = "REVOKED";
    await invite.save();

    await recordAuditEvent({
      userId: req.user._id,
      actor: req.user,
      action: "workspace.invite.revoked",
      category: "workspace",
      severity: "WARN",
      targetType: "invite",
      targetId: String(invite._id),
      metadata: { invitedEmail: invite.invitedEmail },
      req,
    });

    res.json({ success: true, invite: buildInviteResponse(invite) });
  } catch (err) {
    next(err);
  }
};

exports.updateMember = async (req, res, next) => {
  try {
    const member = await User.findOne({
      _id: req.params.id,
      organizationSlug: req.user.organizationSlug,
    });
    if (!member) return res.status(404).json({ success: false, msg: "Member not found" });

    if (String(member._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, msg: "Use your own profile page to update your account" });
    }

    if (normalizeRole(member.role) === "OWNER") {
      return res.status(403).json({ success: false, msg: "Owner role cannot be modified here" });
    }

    const { role, status } = req.body || {};
    if (role) member.role = normalizeRole(role);
    if (status) member.status = normalizeStatus(status);
    await member.save();

    await recordAuditEvent({
      userId: req.user._id,
      actor: req.user,
      action: "workspace.member.updated",
      category: "workspace",
      severity: "INFO",
      targetType: "member",
      targetId: String(member._id),
      metadata: { role: member.role, status: member.status },
      req,
    });

    res.json({ success: true, member: buildMemberView(member) });
  } catch (err) {
    next(err);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    const plan = normalizePlan(req.body?.plan || "STARTER");
    await User.updateMany(getWorkspaceQuery(req.user), { $set: { plan } });

    await recordAuditEvent({
      userId: req.user._id,
      actor: req.user,
      action: "workspace.plan.updated",
      category: "workspace",
      severity: "HIGH",
      targetType: "plan",
      targetId: req.user.organizationSlug || String(req.user._id),
      metadata: { plan },
      req,
    });

    const refreshedUser = await User.findById(req.user._id).select("-password");
    const overview = await platformService.getPlatformOverview(refreshedUser);
    res.json({ success: true, plan, overview });
  } catch (err) {
    next(err);
  }
};

exports.listApiKeys = async (req, res, next) => {
  try {
    const members = await getWorkspaceUsersForKeyOps(req.user);
    const ownerMap = new Map(members.map((member) => [String(member._id), member]));
    const userIds = members.map((member) => member._id);
    const keys = await ApiKey.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).populate("userId", "name email");

    res.json({
      success: true,
      apiKeys: keys.map((item) => buildApiKeyViewWithOwner(item, ownerMap)),
    });
  } catch (err) {
    next(err);
  }
};

exports.createApiKey = async (req, res, next) => {
  try {
    const members = await getWorkspaceUsersForKeyOps(req.user);
    const userIds = members.map((member) => member._id);
    const limits = getPlanLimits(req.user.plan);
    const activeKeyCount = await ApiKey.countDocuments({
      userId: { $in: userIds },
      status: "ACTIVE",
      $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }],
    });

    if (activeKeyCount >= limits.apiKeys) {
      return res.status(400).json({
        success: false,
        msg: `API key limit reached for the ${normalizePlan(req.user.plan)} plan`,
      });
    }

    const { label, scopes, expiresInDays } = req.body || {};
    const created = await createApiKey({
      userId: req.user._id,
      createdBy: req.user._id,
      label,
      scopes: normalizeScopes(scopes),
      expiresInDays,
    });

    await recordAuditEvent({
      userId: req.user._id,
      actor: req.user,
      action: "platform.api_key.created",
      category: "platform",
      severity: "HIGH",
      targetType: "api_key",
      targetId: String(created.apiKey?._id || ""),
      metadata: {
        label: created.apiKey?.label,
        scopes: created.apiKey?.scopes || [],
      },
      req,
    });

    res.status(201).json({
      success: true,
      apiKey: created.apiKey,
      secret: created.secret,
    });
  } catch (err) {
    next(err);
  }
};

exports.revokeApiKey = async (req, res, next) => {
  try {
    const members = await getWorkspaceUsersForKeyOps(req.user);
    const ownerMap = new Map(members.map((member) => [String(member._id), member]));
    const userIds = members.map((member) => member._id);
    const apiKey = await ApiKey.findOne({
      _id: req.params.id,
      userId: { $in: userIds },
    }).populate("userId", "name email");

    if (!apiKey) {
      return res.status(404).json({ success: false, msg: "API key not found" });
    }

    apiKey.status = "REVOKED";
    await apiKey.save();
    const revoked = buildApiKeyViewWithOwner(apiKey, ownerMap);

    await recordAuditEvent({
      userId: req.user._id,
      actor: req.user,
      action: "platform.api_key.revoked",
      category: "platform",
      severity: "HIGH",
      targetType: "api_key",
      targetId: String(revoked._id || ""),
      metadata: {
        label: revoked.label,
        scopes: revoked.scopes || [],
      },
      req,
    });

    res.json({ success: true, apiKey: revoked });
  } catch (err) {
    next(err);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const members = await User.find(getWorkspaceQuery(req.user)).select("_id").lean();
    const userIds = members.map((member) => member._id);
    const logs = await AuditLog.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).limit(limit);

    res.json({
      success: true,
      logs: logs.map((item) => buildAuditResponse(item)),
    });
  } catch (err) {
    next(err);
  }
};
