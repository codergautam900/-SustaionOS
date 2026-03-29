const ApiKey = require("../models/ApiKey");
const AuditLog = require("../models/AuditLog");
const { createApiKey, revokeApiKey, buildApiKeyPublicView, normalizeScopes } = require("../services/apiKey.service");
const { recordAuditEvent, buildAuditResponse } = require("../services/audit.service");
const platformService = require("../services/platform.service");

exports.getOverview = async (req, res, next) => {
  try {
    const overview = await platformService.getPlatformOverview(req.user);
    res.json(overview);
  } catch (err) {
    next(err);
  }
};

exports.listApiKeys = async (req, res, next) => {
  try {
    const keys = await ApiKey.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      apiKeys: keys.map((item) => buildApiKeyPublicView(item)),
    });
  } catch (err) {
    next(err);
  }
};

exports.createApiKey = async (req, res, next) => {
  try {
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
    const revoked = await revokeApiKey({ id: req.params.id, userId: req.user._id });
    if (!revoked) {
      return res.status(404).json({ success: false, msg: "API key not found" });
    }

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
    const logs = await AuditLog.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(limit);
    res.json({
      success: true,
      logs: logs.map((item) => buildAuditResponse(item)),
    });
  } catch (err) {
    next(err);
  }
};
