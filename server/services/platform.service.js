const Data = require("../models/Data");
const Alert = require("../models/Alert");
const SensorDevice = require("../models/SensorDevice");
const ApiKey = require("../models/ApiKey");
const AuditLog = require("../models/AuditLog");
const { buildApiKeyPublicView, isApiKeyExpired } = require("./apiKey.service");
const { getRoleCapabilities, normalizePlan, normalizeRole, normalizeStatus } = require("./accessControl.service");

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

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

const buildPlatformOverviewSnapshot = ({
  user,
  latestTelemetry = null,
  sensors = [],
  alerts = [],
  apiKeys = [],
  auditLogs = [],
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
  const onlineSensors = sensors.filter((sensor) => normalizeSensorStatus(sensor) === "ONLINE").length;
  const degradedSensors = sensors.filter((sensor) => normalizeSensorStatus(sensor) === "DEGRADED").length;
  const offlineSensors = sensors.filter((sensor) => normalizeSensorStatus(sensor) === "OFFLINE").length;
  const latestTelemetryDate = toDate(latestTelemetry?.timestamp || latestTelemetry?.createdAt);
  const telemetryFresh = Boolean(latestTelemetryDate && latestTelemetryDate.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
  const auditCoverage = auditLogs.length;

  const readinessSignals = [
    Boolean(user?.organizationName),
    Boolean(user?.apiAccessEnabled),
    activeKeys.length > 0,
    sensors.length > 0,
    telemetryFresh,
    auditCoverage > 0,
  ];
  const readinessScore = Math.round((readinessSignals.filter(Boolean).length / readinessSignals.length) * 100);

  const recommendations = [];
  if (!user?.organizationName) recommendations.push("Add workspace branding so exports and audits look enterprise-ready.");
  if (!user?.apiAccessEnabled || activeKeys.length === 0) {
    recommendations.push("Issue at least one scoped ingest API key for sensor, webhook, or BMS integrations.");
  }
  if (sensors.length === 0) recommendations.push("Register sensors or gateways so asset health and telemetry coverage can be monitored.");
  if (!telemetryFresh) recommendations.push("Stream fresh telemetry this week to keep forecasts, alerts, and mission control trustworthy.");
  if (auditCoverage === 0) recommendations.push("Run a few admin actions so the audit trail starts capturing operational history.");
  if (criticalAlerts.length > 0) recommendations.push("Resolve critical alerts quickly so readiness is not blocked by unresolved incident pressure.");

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
      label: readinessScore >= 85 ? "Enterprise Ready" : readinessScore >= 65 ? "Operationally Strong" : readinessScore >= 45 ? "Scaling Up" : "Foundational",
      recommendations: recommendations.slice(0, 5),
    },
    operations: {
      latestTelemetryAt: latestTelemetryDate ? latestTelemetryDate.toISOString() : null,
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
    integrations: [
      {
        label: "Manual telemetry API",
        method: "POST",
        path: "/api/data",
        auth: ["Bearer token", "API key"],
        scope: "ingest:telemetry",
      },
      {
        label: "MQTT-style gateway ingest",
        method: "POST",
        path: "/api/iot/mqtt/ingest",
        auth: ["Bearer token", "API key"],
        scope: "ingest:telemetry",
      },
      {
        label: "Webhook ingest",
        method: "POST",
        path: "/api/iot/webhook/ingest",
        auth: ["Bearer token", "API key"],
        scope: "ingest:telemetry",
      },
      {
        label: "Mission control analytics",
        method: "GET",
        path: "/api/analytics/command-center",
        auth: ["Bearer token"],
        scope: "analytics:read",
      },
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
  const [latestTelemetry, sensors, alerts, apiKeys, auditLogs] = await Promise.all([
    Data.findOne({ userId: user._id }).sort({ timestamp: -1, createdAt: -1 }),
    SensorDevice.find({ userId: user._id }).sort({ lastSeen: -1, createdAt: -1 }),
    Alert.find({ userId: user._id }).sort({ time: -1, createdAt: -1 }).limit(40),
    ApiKey.find({ userId: user._id }).sort({ createdAt: -1 }),
    AuditLog.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20),
  ]);

  return buildPlatformOverviewSnapshot({
    user,
    latestTelemetry,
    sensors,
    alerts,
    apiKeys,
    auditLogs,
  });
};

module.exports = {
  buildPlatformOverviewSnapshot,
  getPlatformOverview,
};
