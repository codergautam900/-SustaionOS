const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const authOrApiKey = require("../middleware/authOrApiKey.middleware");
const requireScope = require("../middleware/requireScope.middleware");
const ctrl = require("../controllers/iot.controller");

router.get("/bridge", auth, ctrl.getBridgeStatus);
router.post("/mqtt/ingest", authOrApiKey, requireScope("ingest:telemetry"), ctrl.ingestMqtt);
router.post("/webhook/ingest", authOrApiKey, requireScope("ingest:telemetry"), ctrl.ingestWebhook);

module.exports = router;
