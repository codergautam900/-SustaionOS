const router = require("express").Router();
const auth = require("../controllers/auth.controller");
const rateLimit = require("../middleware/rateLimit.middleware");

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Too many authentication attempts. Please retry in a few minutes.",
});

router.post("/register", authRateLimit, auth.register);
router.post("/login", authRateLimit, auth.login);

module.exports = router;
