const calculateScore = (data) => {

 let score = 100;

 if(data.energy > 500){
  score -= 10;
 }

 if(data.water > 200){
  score -= 5;
 }

 if(data.carbon > 100){
  score -= 8;
 }

 if(score < 0){
  score = 0;
 }

 return score;

};

module.exports = calculateScore;