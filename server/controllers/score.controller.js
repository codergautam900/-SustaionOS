const scoreService = require("../services/sustainabilityScore.engine");

exports.getScore = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ score: 0, msg: "Unauthorized" });
    }
    const result = await scoreService.calculateScore(req.user._id);
    res.json(result);

  } catch (err) {
    console.error("Score Error:", err);
    res.status(500).json({ msg: "Score calculation error" });
  }
};
