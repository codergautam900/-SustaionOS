const express=require("express");
const router=express.Router();
const controller=require("../controllers/report.controller");
const auth=require("../middleware/authMiddleware");

router.get("/data", auth, controller.getReportData); 
router.get("/pdf", auth, controller.downloadReport);

module.exports=router;
