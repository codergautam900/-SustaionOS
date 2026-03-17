const Data=require("../models/Data");
const Alert=require("../models/Alert");
const calc=require("../services/sustainabilityScore").calculateScore;

exports.getScore=async(req,res)=>{
 const records=await Data.find();
 const alerts=await Alert.find();

 const result=calc(records,alerts);

 res.json(result);
};