const mongoose = require("mongoose");

const buildRuntimeWarnings = (config = {}) => {
  const warnings = [];

  if (!config.JWT_SECRET) {
    warnings.push("JWT_SECRET is missing. Authentication will not be safe to run.");
  }

  if (!config.MONGO_URI) {
    warnings.push("MONGO_URI is missing. The API can only run in degraded mode.");
  }

  if (config.AI_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
    warnings.push("AI_PROVIDER is set to openai but OPENAI_API_KEY is missing.");
  }

  if (config.AI_PROVIDER === "gemini" && !config.GEMINI_API_KEY) {
    warnings.push("AI_PROVIDER is set to gemini but GEMINI_API_KEY is missing.");
  }

  if (config.AI_PROVIDER === "ollama" && !config.OLLAMA_URL) {
    warnings.push("AI_PROVIDER is set to ollama but OLLAMA_URL is missing.");
  }

  return warnings;
};

const validateRuntimeConfig = (config = {}) => {
  const errors = [];
  const warnings = buildRuntimeWarnings(config);

  if (!config.JWT_SECRET) {
    errors.push("JWT_SECRET is required");
  }

  if (String(config.NODE_ENV || "").toLowerCase() === "production" && !config.MONGO_URI) {
    errors.push("MONGO_URI is required in production");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
};

const buildHealthPayload = ({
  kind = "live",
  dbReady = false,
  startedAt = null,
  warnings = [],
  requestId = "",
} = {}) => {
  const mongoState = mongoose.connection.readyState;
  const isReady = Boolean(dbReady);

  return {
    success: kind === "live" ? true : isReady,
    status: kind === "live" ? "LIVE" : isReady ? "READY" : "DEGRADED",
    kind,
    dbReady: isReady,
    mongoState,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt,
    timestamp: new Date().toISOString(),
    warnings,
    requestId,
  };
};

module.exports = {
  buildRuntimeWarnings,
  validateRuntimeConfig,
  buildHealthPayload,
};
