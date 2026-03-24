const Data=require("../models/Data");

exports.findCause=async(userId=null)=>{

 const filter = userId ? { userId } : {};
 const records=await Data.find(filter).sort({createdAt:-1}).limit(5);

 if(records.length<2)
  return "Not enough data for analysis.";

 const latest=records[0];
 const prevAvg=
  records.slice(1).reduce((s,r)=>s+(Number(r.water)||0),0)/(records.length-1);

const energyAvg=
  records.slice(1).reduce((s,r)=>s+(Number(r.energy)||0),0)/(records.length-1);

 // WATER SPIKE
 if(latest.water > prevAvg*1.25)
  return "Sudden water spike detected. Possible leakage or valve fault.";

 // ENERGY SPIKE
 if(latest.energy > energyAvg*1.25)
  return "Energy spike detected. Heavy device usage or system overload.";

 // CONSTANT HIGH
 if(latest.energy>energyAvg && latest.water>prevAvg)
  return "Both water and energy above average. Possible operational inefficiency.";

 return "No abnormal root cause detected.";
};
