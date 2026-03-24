const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/notification.controller");

router.get("/", auth, ctrl.getNotifications);
router.patch("/:id/read", auth, ctrl.markRead);
router.patch("/read-all", auth, ctrl.markAllRead);

module.exports = router;
