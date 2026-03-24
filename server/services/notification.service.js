const Notification = require("../models/Notification");

const normalizePriority = (value) => {
  const up = (value || "").toString().toUpperCase();
  if (up === "HIGH") return "HIGH";
  if (up === "MEDIUM") return "MEDIUM";
  return "LOW";
};

exports.createNotification = async ({
  userId,
  type = "SYSTEM",
  title,
  message,
  link = "/",
  priority = "LOW",
  dedupeKey = "",
  metadata = {},
  time = new Date(),
  dedupeWindowMinutes = 120,
}) => {
  try {
    if (!userId || !title || !message) return null;

    if (dedupeKey) {
      const since = new Date(Date.now() - dedupeWindowMinutes * 60 * 1000);
      const existing = await Notification.findOne({
        userId,
        dedupeKey,
        createdAt: { $gte: since },
      }).sort({ createdAt: -1 });

      if (existing) return existing;
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      link,
      priority: normalizePriority(priority),
      dedupeKey,
      metadata,
      time,
    });

    if (global.io) {
      global.io.emit("newNotification", notification);
    }

    return notification;
  } catch (err) {
    console.error("Notification Service Error:", err.message);
    return null;
  }
};
