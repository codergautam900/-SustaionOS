const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ success: false, msg: "Unauthorized" });

    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const unreadOnly = String(req.query.unreadOnly || "") === "true";
    const filter = { userId: req.user._id };
    if (unreadOnly) filter.read = false;

    const notifications = await Notification.find(filter).sort({ time: -1, createdAt: -1 }).limit(limit);
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

    return res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error("Get Notifications Error:", err);
    return res.status(500).json({ success: false, msg: "Server Error" });
  }
};

exports.markRead = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ success: false, msg: "Unauthorized" });

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { returnDocument: "after" }
    );

    if (!notification) return res.status(404).json({ success: false, msg: "Notification not found" });

    return res.json({ success: true, notification });
  } catch (err) {
    console.error("Mark Notification Read Error:", err);
    return res.status(500).json({ success: false, msg: "Server Error" });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ success: false, msg: "Unauthorized" });

    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Mark All Notifications Read Error:", err);
    return res.status(500).json({ success: false, msg: "Server Error" });
  }
};
