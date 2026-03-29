const crypto = require("crypto");

const ApiKey = require("../models/ApiKey");

const ALLOWED_SCOPES = ["ingest:telemetry", "alerts:write", "analytics:read"];

const normalizeScopes = (scopes = []) => {
  const input = Array.isArray(scopes) ? scopes : [scopes];
  const normalized = input
    .map((scope) => String(scope || "").trim())
    .filter(Boolean)
    .filter((scope) => ALLOWED_SCOPES.includes(scope));

  return normalized.length ? Array.from(new Set(normalized)) : ["ingest:telemetry"];
};

const hashApiKey = (value = "") =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const buildApiKeySecret = () => {
  const secret = `sos_live_${crypto.randomBytes(24).toString("hex")}`;
  const compact = secret.replace(/[^a-z0-9]/gi, "");
  return {
    secret,
    prefix: secret.slice(0, 12),
    lastFour: compact.slice(-4),
    hash: hashApiKey(secret),
  };
};

const buildApiKeyPublicView = (record) => {
  if (!record) return null;
  const source = typeof record.toObject === "function" ? record.toObject() : { ...record };

  return {
    _id: source._id,
    label: source.label,
    prefix: source.prefix,
    lastFour: source.lastFour,
    status: source.status,
    scopes: Array.isArray(source.scopes) ? source.scopes : [],
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    expiresAt: source.expiresAt,
    lastUsedAt: source.lastUsedAt,
    lastUsedFromIp: source.lastUsedFromIp || "",
  };
};

const isApiKeyExpired = (apiKey) =>
  Boolean(apiKey?.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now());

const createApiKey = async ({ userId, createdBy, label, scopes, expiresInDays = 90 }) => {
  const normalizedLabel = String(label || "").trim().slice(0, 80) || "Telemetry ingest";
  const normalizedScopes = normalizeScopes(scopes);
  const expiresAt =
    Number.isFinite(Number(expiresInDays)) && Number(expiresInDays) > 0
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : null;

  const secretPayload = buildApiKeySecret();
  const record = await ApiKey.create({
    userId,
    createdBy: createdBy || userId,
    label: normalizedLabel,
    hash: secretPayload.hash,
    prefix: secretPayload.prefix,
    lastFour: secretPayload.lastFour,
    scopes: normalizedScopes,
    expiresAt,
    status: "ACTIVE",
  });

  return {
    secret: secretPayload.secret,
    apiKey: buildApiKeyPublicView(record),
  };
};

const revokeApiKey = async ({ id, userId }) => {
  const apiKey = await ApiKey.findOne({ _id: id, userId });
  if (!apiKey) return null;
  apiKey.status = "REVOKED";
  await apiKey.save();
  return buildApiKeyPublicView(apiKey);
};

const markApiKeyUsage = async (apiKey, req) => {
  if (!apiKey) return;
  apiKey.lastUsedAt = new Date();
  apiKey.lastUsedFromIp =
    String(req?.headers?.["x-forwarded-for"] || req?.ip || "")
      .split(",")[0]
      .trim()
      .slice(0, 80) || "";
  await apiKey.save();
};

module.exports = {
  ALLOWED_SCOPES,
  normalizeScopes,
  hashApiKey,
  buildApiKeySecret,
  buildApiKeyPublicView,
  isApiKeyExpired,
  createApiKey,
  revokeApiKey,
  markApiKeyUsage,
};
