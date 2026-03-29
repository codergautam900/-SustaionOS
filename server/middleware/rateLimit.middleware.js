const windows = new Map();

module.exports = ({ windowMs = 15 * 60 * 1000, max = 15, message = "Too many requests" } = {}) =>
  (req, res, next) => {
    const key = String(req.headers["x-forwarded-for"] || req.ip || "unknown")
      .split(",")[0]
      .trim();
    const now = Date.now();
    const bucket = windows.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    windows.set(key, bucket);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({ success: false, msg: message });
    }

    next();
  };
