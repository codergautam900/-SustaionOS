const PDFDocument = require("pdfkit");
const reportService = require("../services/report.service");

exports.getReportData = async (req, res, next) => {
  try {
    const report = await reportService.generateReportData(req.user?._id || null);
    res.json(report);
  } catch (err) {
    next(err);
  }
};

exports.downloadReport = async (req, res, next) => {
  try {
    const report = await reportService.generateReportData(req.user?._id || null);

    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Sustainability_Report.pdf"
    );

    doc.pipe(res);

    doc.fontSize(20).text("SustainOS Sustainability Report", {
      align: "center",
    });

    doc.moveDown();

    doc.fontSize(14).text(`Total Water Usage: ${report.totalWater} L`);
    doc.text(`Total Energy Usage: ${report.totalEnergy} kWh`);
    doc.text(`Alerts Triggered: ${report.alerts}`);
    doc.text(`Estimated Cost: Rs. ${report.cost}`);
    doc.text(`Carbon Emission: ${report.carbon} kg`);

    if (report.topBuilding) {
      doc.moveDown();
      doc.text(`Highest Consumption Building: ${report.topBuilding.building}`);
      doc.text(`Energy: ${report.topBuilding.energy} kWh | Water: ${report.topBuilding.water} L`);
      if (report.topBuilding.locations?.length) {
        doc.text(`Locations: ${report.topBuilding.locations.join(", ")}`);
      }
    }

    if (report.insights?.nextBestAction) {
      doc.moveDown();
      doc.text(`Next Best Action: ${report.insights.nextBestAction}`);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
};
