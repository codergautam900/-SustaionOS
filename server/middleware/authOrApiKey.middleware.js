const jwt = require("jsonwebtoken");

const User = require("../models/User");
const ApiKey = require("../models/ApiKey");
const { JWT_SECRET } = require("../config/env");
const { hashApiKey, isApiKeyExpired, markApiKeyUsage } = require("../services/apiKey.service");
const { normalizeRole, normalizePlan, normalizeStatus } = require("../services/accessControl.service");

const enrichUser = (user) => {
  if (!user) return null;
  user.role = normalizeRole(user.role);
  user.plan = normalizePlan(user.plan);
  user.status = normalizeStatus(user.status);
  return user;
};

module.exports = async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const apiKeyHeader = String(
      req.headers["x-api-key"] || req.headers["x-ingest-key"] || (!bearerToken.startsWith("eyJ") ? bearerToken : "")
    ).trim();

    if (bearerToken && bearerToken.startsWith("eyJ")) {
      const decoded = jwt.verify(bearerToken, JWT_SECRET);
      const user = await User.findById(decoded._id).select("-password");
      if (!user) return res.status(401).json({ success: false, msg: "Invalid token user" });

      req.user = enrichUser(user);
      req.authContext = { type: "jwt", scopes: ["*"] };
      return next();
    }

    if (apiKeyHeader) {
      const apiKey = await ApiKey.findOne({ hash: hashApiKey(apiKeyHeader) });
      if (!apiKey) return res.status(401).json({ success: false, msg: "Invalid API key" });
      if (apiKey.status !== "ACTIVE") {
        return res.status(401).json({ success: false, msg: "API key is not active" });
      }
      if (isApiKeyExpired(apiKey)) {
        apiKey.status = "EXPIRED";
        await apiKey.save();
        return res.status(401).json({ success: false, msg: "API key expired" });
      }

      const user = await User.findById(apiKey.userId).select("-password");
      if (!user) return res.status(401).json({ success: false, msg: "API key owner missing" });
      if (!user.apiAccessEnabled) {
        return res.status(403).json({ success: false, msg: "API access disabled for this workspace" });
      }

      await markApiKeyUsage(apiKey, req);

      req.user = enrichUser(user);
      req.apiKey = apiKey;
      req.authContext = {
        type: "apiKey",
        apiKeyId: String(apiKey._id),
        scopes: Array.isArray(apiKey.scopes) ? apiKey.scopes : [],
      };
      return next();
    }

    return res.status(401).json({ success: false, msg: "No token or API key provided" });
  } catch (err) {
    console.error(`[AuthOrApiKey] Path: ${req.path} - Error:`, err.message || err);
    return res.status(401).json({ success: false, msg: "Authorization failed" });
  }
};
