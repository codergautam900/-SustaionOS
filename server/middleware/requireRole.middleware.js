const { hasAnyRole, normalizeRole } = require("../services/accessControl.service");

module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, msg: "Unauthorized" });
  }

  if (!hasAnyRole(req.user.role, allowedRoles)) {
    return res.status(403).json({
      success: false,
      msg: `Requires one of: ${allowedRoles.map((role) => normalizeRole(role)).join(", ")}`,
    });
  }

  next();
};
