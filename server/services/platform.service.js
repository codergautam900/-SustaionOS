const User = require("../models/User");
const Data = require("../models/Data");
const Alert = require("../models/Alert");
const SensorDevice = require("../models/SensorDevice");
const ApiKey = require("../models/ApiKey");
const AuditLog = require("../models/AuditLog");
const WorkspaceInvite = require("../models/WorkspaceInvite");
const { buildApiKeyPublicView, isApiKeyExpired } = require("./apiKey.service");
const { buildInviteResponse, isInviteExpired } = require("./workspaceInvite.service");
const {
  buildPlanUsage,
  getRoleCapabilities,
  normalizePlan,
  normalizeRole,
  normalizeStatus,
} = require("./accessControl.service");

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getWorkspaceQuery = (user = {}) =>
  user?.organizationSlug ? { organizationSlug: user.organizationSlug } : { _id: user?._id };

const normalizeSensorStatus = (sensor = {}) => {
  const status = String(sensor.status || "").toUpperCase();
  if (status === "OFFLINE" || status === "DEGRADED" || status === "ONLINE") return status;
  if (sensor.lastSeen) {
    const ageMinutes = (Date.now() - new Date(sensor.lastSeen).getTime()) / 60000;
    if (ageMinutes <= 15) return "ONLINE";
    if (ageMinutes <= 60) return "DEGRADED";
    return "OFFLINE";
  }
  return "UNKNOWN";
};

const buildMemberResponse = (member) => ({
  _id: member._id,
  name: member.name,
  email: member.email,
  role: normalizeRole(member.role),
  status: normalizeStatus(member.status),
  building: member.building || "",
  lastLoginAt: member.lastLoginAt || null,
  createdAt: member.createdAt || null,
});

const buildPlatformOverviewSnapshot = ({
  user,
  members = [],
  invites = [],
  latestTelemetry = null,
  sensors = [],
  alerts = [],
  apiKeys = [],
  auditLogs = [],
  monthlyTelemetry = 0,
} = {}) => {
  const normalizedRole = normalizeRole(user?.role);
  const normalizedPlan = normalizePlan(user?.plan);
  const normalizedStatus = normalizeStatus(user?.status);

  const activeAlerts = alerts.filter((alert) => (alert.status || "OPEN") !== "RESOLVED");
  const criticalAlerts = activeAlerts.filter((alert) => String(alert.severity || "").toUpperCase() === "HIGH");
  const activeKeys = apiKeys.filter((item) => item.status === "ACTIVE" && !isApiKeyExpired(item));
  const expiringSoonKeys = activeKeys.filter((item) => {
    const expiresAt = toDate(item.expiresAt);
    return Boolean(expiresAt && expiresAt.getTime() - Date.now() <= 14 * 24 * 60 * 60 * 1000);
  });
  const activeInvites = invites.filter((item) => item.status === "PENDING" && !isInviteExpired(item));
  const onlineSensors = sensors.filter((sensor) => normalizeSensorStatus(sensor) === "ONLINE").length;
  const degradedSensors = sensors.filter((sensor) => normalizeSensorStatus(sensor) === "DEGRADED").length;
  const offlineSensors = sensors.filter((sensor) => normalizeSensorStatus(sensor) === "OFFLINE").length;
  const latestTelemetryDate = toDate(latestTelemetry?.timestamp || latestTelemetry?.createdAt);
  const telemetryFresh = Boolean(latestTelemetryDate && latestTelemetryDate.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
  const auditCoverage = auditLogs.length;
  const planUsage = buildPlanUsage(normalizedPlan, {
    members: members.length + activeInvites.length,
    apiKeys: activeKeys.length,
    sensors: sensors.length,
    monthlyTelemetry,
  });

  const readinessSignals = [
    Boolean(user?.organizationName),
    Boolean(user?.apiAccessEnabled),
    activeKeys.length > 0,
    sensors.length > 0,
    telemetryFresh,
    auditCoverage > 0,
    members.length > 1 || activeInvites.length > 0,
  ];
  const readinessScore = Math.round((readinessSignals.filter(Boolean).length / readinessSignals.length) * 100);

  const recommendations = [];
  if (!user?.organizationName) recommendations.push("Add workspace branding so exports and audits look enterprise-ready.");
  if (!user?.apiAccessEnabled || activeKeys.length === 0) recommendations.push("Issue at least one scoped ingest API key for sensor, webhook, or BMS integrations.");
  if (sensors.length === 0) recommendations.push("Register sensors or gateways so asset health and telemetry coverage can be monitored.");
  if (!telemetryFresh) recommendations.push("Stream fresh telemetry this week to keep forecasts, alerts, and mission control trustworthy.");
  if (auditCoverage === 0) recommendations.push("Run a few admin actions so the audit trail starts capturing operational history.");
  if (criticalAlerts.length > 0) recommendations.push("Resolve critical alerts quickly so readiness is not blocked by unresolved incident pressure.");
  if (members.length === 1 && activeInvites.length === 0) recommendations.push("Invite operators or analysts so the workspace can run as a real team SaaS product.");
  if (planUsage.metrics.some((metric) => metric.nearLimit)) recommendations.push("Your workspace is approaching plan limits. Consider upgrading the plan tier.");

  const rolesBreakdown = members.reduce((acc, member) => {
    const role = normalizeRole(member.role);
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return {
    workspace: {
      organizationName: user?.organizationName || "SustainOS Workspace",
      organizationSlug: user?.organizationSlug || "",
      industry: user?.industry || "Smart Buildings",
      teamName: user?.teamName || "Operations",
      timezone: user?.timezone || "Asia/Kolkata",
      plan: normalizedPlan,
      role: normalizedRole,
      status: normalizedStatus,
      apiAccessEnabled: Boolean(user?.apiAccessEnabled),
      mfaEnabled: Boolean(user?.mfaEnabled),
      memberSince: user?.createdAt || null,
      lastLoginAt: user?.lastLoginAt || null,
      dataRetentionDays: Number(user?.dataRetentionDays || 365),
      capabilities: getRoleCapabilities(normalizedRole),
    },
    readiness: {
      score: readinessScore,
      label:
        readinessScore >= 85
          ? "Enterprise Ready"
          : readinessScore >= 65
            ? "Operationally Strong"
            : readinessScore >= 45
              ? "Scaling Up"
              : "Foundational",
      recommendations: recommendations.slice(0, 6),
    },
    operations: {
      latestTelemetryAt: latestTelemetryDate ? latestTelemetryDate.toISOString() : null,
      monthlyTelemetry,
      sensors: {
        total: sensors.length,
        online: onlineSensors,
        degraded: degradedSensors,
        offline: offlineSensors,
      },
      alerts: {
        active: activeAlerts.length,
        critical: criticalAlerts.length,
      },
      apiKeys: {
        total: apiKeys.length,
        active: activeKeys.length,
        expiringSoon: expiringSoonKeys.length,
      },
      auditEvents: auditLogs.length,
    },
    planUsage,
    team: {
      membersCount: members.length,
      pendingInvites: activeInvites.length,
      rolesBreakdown,
      members: members.map((member) => buildMemberResponse(member)),
      invites: activeInvites.map((invite) => buildInviteResponse(invite)),
    },
    integrations: [
      { label: "Manual telemetry API", method: "POST", path: "/api/data", auth: ["Bearer token", "API key"], scope: "ingest:telemetry" },
      { label: "MQTT-style gateway ingest", method: "POST", path: "/api/iot/mqtt/ingest", auth: ["Bearer token", "API key"], scope: "ingest:telemetry" },
      { label: "Webhook ingest", method: "POST", path: "/api/iot/webhook/ingest", auth: ["Bearer token", "API key"], scope: "ingest:telemetry" },
      { label: "Mission control analytics", method: "GET", path: "/api/analytics/command-center", auth: ["Bearer token"], scope: "analytics:read" },
    ],
    apiKeys: activeKeys.map((item) => buildApiKeyPublicView(item)).slice(0, 6),
    auditFeed: auditLogs.slice(0, 8).map((item) => ({
      _id: item._id,
      action: item.action,
      category: item.category,
      severity: item.severity,
      status: item.status,
      createdAt: item.createdAt,
      actorName: item.actorName,
      metadata: item.metadata || {},
    })),
  };
};

const getPlatformOverview = async (user) => {
  const workspaceQuery = getWorkspaceQuery(user);
  const members = await User.find(workspaceQuery).select("-password").sort({ createdAt: 1 });
  const userIds = members.map((member) => member._id);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [latestTelemetry, sensors, alerts, apiKeys, auditLogs, invites, monthlyTelemetry] = await Promise.all([
    Data.findOne({ userId: { $in: userIds } }).sort({ timestamp: -1, createdAt: -1 }),
    SensorDevice.find({ userId: { $in: userIds } }).sort({ lastSeen: -1, createdAt: -1 }),
    Alert.find({ userId: { $in: userIds } }).sort({ time: -1, createdAt: -1 }).limit(50),
    ApiKey.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }),
    AuditLog.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).limit(25),
    WorkspaceInvite.find({ organizationSlug: user.organizationSlug }).sort({ createdAt: -1 }).limit(20),
    Data.countDocuments({ userId: { $in: userIds }, timestamp: { $gte: last30Days } }),
  ]);

  return buildPlatformOverviewSnapshot({
    user,
    members,
    invites,
    latestTelemetry,
    sensors,
    alerts,
    apiKeys,
    auditLogs,
    monthlyTelemetry,
  });
};

module.exports = {
  buildPlatformOverviewSnapshot,
  getPlatformOverview,
};
