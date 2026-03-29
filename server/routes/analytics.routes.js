const express = require("express");
const router = express.Router();
const controller = require("../controllers/analytics.controller");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole.middleware");

// Protect analytics routes so req.user is available
router.use(authMiddleware);

router.get("/summary", controller.getAnalytics);
router.get("/score", controller.getScore);
router.get("/trend", controller.getTrend);
router.get("/history", controller.getHistory);
router.get("/insights", controller.getInsights);
router.get("/command-center", controller.getCommandCenter);
router.get("/model", controller.getModelStatus);
router.post("/model/train", requireRole("OWNER", "ADMIN", "OPERATOR"), controller.trainModel);

module.exports = router;
