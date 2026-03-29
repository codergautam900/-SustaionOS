const AuditLog = require("../models/AuditLog");

const normalizeSeverity = (value = "INFO") => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["INFO", "WARN", "HIGH"].includes(normalized)) return normalized;
  return "INFO";
};

const normalizeStatus = (value = "SUCCESS") => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["SUCCESS", "FAILED"].includes(normalized)) return normalized;
  return "SUCCESS";
};

const getRequestIp = (req) =>
  String(req?.headers?.["x-forwarded-for"] || req?.ip || "")
    .split(",")[0]
    .trim()
    .slice(0, 80);

const buildAuditResponse = (record) => {
  if (!record) return null;
  const source = typeof record.toObject === "function" ? record.toObject() : { ...record };
  return {
    _id: source._id,
    category: source.category,
    action: source.action,
    severity: source.severity,
    status: source.status,
    targetType: source.targetType,
    targetId: source.targetId,
    actorName: source.actorName,
    actorEmail: source.actorEmail,
    ip: source.ip,
    metadata: source.metadata || {},
    createdAt: source.createdAt,
  };
};

const recordAuditEvent = async ({
  userId,
  actor = null,
  action,
  category = "platform",
  severity = "INFO",
  status = "SUCCESS",
  targetType = "",
  targetId = "",
  metadata = {},
  req = null,
}) => {
  if (!userId || !action || global.dbReady === false) return null;

  try {
    const audit = await AuditLog.create({
      userId,
      actorId: actor?._id || null,
      actorName: actor?.name || "",
      actorEmail: actor?.email || "",
      category,
      action,
      severity: normalizeSeverity(severity),
      status: normalizeStatus(status),
      targetType: String(targetType || "").trim().slice(0, 80),
      targetId: String(targetId || "").trim().slice(0, 120),
      ip: getRequestIp(req),
      userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 240),
      metadata,
    });

    return buildAuditResponse(audit);
  } catch (err) {
    console.error("Audit log write failed:", err.message || err);
    return null;
  }
};

module.exports = {
  buildAuditResponse,
  recordAuditEvent,
};
