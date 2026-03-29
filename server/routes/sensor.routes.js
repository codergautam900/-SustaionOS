const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const authOrApiKey = require("../middleware/authOrApiKey.middleware");
const requireScope = require("../middleware/requireScope.middleware");
const ctrl = require("../controllers/sensor.controller");
const validate = require("../middleware/validate.middleware");
const dataCtrl = require("../controllers/data.Controller");

router.get("/", auth, ctrl.getSensors);
router.get("/summary", auth, ctrl.getSensorSummary);
router.post("/", auth, ctrl.registerSensor);
router.patch("/:id/ping", auth, ctrl.pingSensor);
router.post("/ingest", authOrApiKey, requireScope("ingest:telemetry"), validate, ctrl.ingestSensorTelemetry);
router.post("/telemetry", authOrApiKey, requireScope("ingest:telemetry"), validate, dataCtrl.sendData);

module.exports = router;
