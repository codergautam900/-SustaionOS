const express = require("express");

const auth = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole.middleware");
const ctrl = require("../controllers/platform.controller");

const router = express.Router();

router.use(auth);

router.get("/overview", ctrl.getOverview);
router.get("/audit", requireRole("OWNER", "ADMIN", "OPERATOR", "ANALYST"), ctrl.getAuditLogs);
router.get("/api-keys", requireRole("OWNER", "ADMIN"), ctrl.listApiKeys);
router.post("/api-keys", requireRole("OWNER", "ADMIN"), ctrl.createApiKey);
router.delete("/api-keys/:id", requireRole("OWNER", "ADMIN"), ctrl.revokeApiKey);

module.exports = router;
