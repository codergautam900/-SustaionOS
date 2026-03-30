const { NODE_ENV } = require("../config/env");

module.exports = (err, req, res, next) => {
  const statusCode = Number(err?.statusCode || err?.status || 500);
  const message =
    statusCode >= 500
      ? "Server Error"
      : err?.message || "Request failed";

  console.error(`[${req?.requestId || "no-request-id"}]`, err?.stack || err);

  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req?.requestId || "",
    path: req?.originalUrl || req?.path || "",
    ...(NODE_ENV !== "production" && err?.message
      ? { debugMessage: err.message }
      : {}),
  });
};
