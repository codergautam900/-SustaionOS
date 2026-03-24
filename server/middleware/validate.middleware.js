module.exports = (req, res, next) => {
  let { building, location, water, energy } = req.body;

  if (!building || water === undefined || energy === undefined) {
    return res.status(400).json({
      success: false,
      msg: "All fields (building, water, energy) are required",
    });
  }

  building = building.trim();
  location = typeof location === "string" ? location.trim() : "";

  if (building.length < 2) {
    return res.status(400).json({
      success: false,
      msg: "Building name must be at least 2 characters",
    });
  }

  water = Number(water);
  energy = Number(energy);

  if (isNaN(water) || isNaN(energy)) {
    return res.status(400).json({
      success: false,
      msg: "Water and Energy must be valid numbers",
    });
  }

  if (water < 0 || energy < 0) {
    return res.status(400).json({
      success: false,
      msg: "Values cannot be negative",
    });
  }

  if (water > 100000 || energy > 10000) {
    return res.status(400).json({
      success: false,
      msg: "Values exceed realistic limits",
    });
  }

  req.body = {
    building,
    location,
    water,
    energy,
  };

  next();
};
