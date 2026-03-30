const express = require("express");
const cors = require("cors");
const { CLIENT_ORIGIN } = require("./config/env");
const requestContext = require("./middleware/requestContext.middleware");
const { buildHealthPayload } = require("./services/runtime.service");

const app = express();

const allowedOrigins = String(CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true, // allow cookies / credentialed requests and Authorization header
  })
);

app.use(requestContext);
app.use(express.json());

app.get("/api/health", (req, res) =>
  res.json(
    buildHealthPayload({
      kind: "ready",
      dbReady: Boolean(global.dbReady),
      startedAt: global.startedAt || null,
      warnings: global.runtimeWarnings || [],
      requestId: req.requestId,
    })
  )
);

app.get("/api/health/live", (req, res) =>
  res.json(
    buildHealthPayload({
      kind: "live",
      dbReady: Boolean(global.dbReady),
      startedAt: global.startedAt || null,
      warnings: global.runtimeWarnings || [],
      requestId: req.requestId,
    })
  )
);

app.get("/api/health/ready", (req, res) => {
  const payload = buildHealthPayload({
    kind: "ready",
    dbReady: Boolean(global.dbReady),
    startedAt: global.startedAt || null,
    warnings: global.runtimeWarnings || [],
    requestId: req.requestId,
  });

  if (!payload.dbReady) {
    return res.status(503).json(payload);
  }

  return res.json(payload);
});

app.use((req, res, next) => {
  if (
    req.path === "/api/health" ||
    req.path === "/api/health/live" ||
    req.path === "/api/health/ready" ||
    req.path === "/api/ai/query"
  ) {
    return next();
  }

  if (req.path.startsWith("/api/") && !global.dbReady) {
    return res.status(503).json({
      success: false,
      msg: "Database unavailable",
      dbReady: false,
      requestId: req.requestId,
    });
  }

  next();
});

app.use("/api/data", require("./routes/data.routes"));
app.use("/api/alerts", require("./routes/alert.routes"));
app.use("/api/predict", require("./routes/prediction.routes"));
app.use("/api/cost", require("./routes/cost.routes"));
app.use("/api/carbon", require("./routes/carbon.routes"));
app.use("/api/score", require("./routes/score.routes"));
app.use("/api/report", require("./routes/report.routes"));
app.use("/api/ai", require("./routes/ai.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/sensors", require("./routes/sensor.routes"));
app.use("/api/iot", require("./routes/iot.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/settings", require("./routes/settings.routes"));
app.use("/api/user", require("./routes/user.routes"));
app.use("/api/analytics", require("./routes/analytics.routes"));
app.use("/api/platform", require("./routes/platform.routes"));

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API route not found",
    requestId: req.requestId,
    path: req.originalUrl,
  });
});

app.use(require("./middleware/error.middleware"));

module.exports = app;
