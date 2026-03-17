const router = require("express").Router();
const ctrl = require("../controllers/data.Controller");
const validate = require("../middleware/validate.middleware");
const Data = require("../models/Data");

// 🔥 REAL DATA FOR DASHBOARD
router.get("/", async (req, res) => {
  try {
    const latest = await Data.findOne().sort({ timestamp: -1 });

    if (!latest) {
      return res.json({
        energy: 0,
        water: 0,
        building: "No Data Available"
      });
    }

    res.json({
      energy: latest.energy,
      water: latest.water,
      building: latest.building,
      timestamp: latest.timestamp
    });

  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 📊 HISTORY
router.get("/history", ctrl.getHistory);

// 📥 ADD DATA
router.post("/", validate, ctrl.sendData);

module.exports = router;