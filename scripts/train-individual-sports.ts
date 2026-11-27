import {additionalSports} from '../src/shared/individual-sports.js';
import {trainSport} from '../server/sport-training.js';

const results=await Promise.allSettled(additionalSports.map(sport=>trainSport(sport,process.env)));
for (const [index,result] of results.entries()) {
  if(result.status==='fulfilled') console.info(JSON.stringify({individualSportTraining:result.value}));
  else {
    const code=String(result.reason?.message??'').match(/^RESULTS_[A-Z0-9_]+$/)?.[0]??'RESULTS_UNAVAILABLE';
    console.info(JSON.stringify({individualSportTrainingError:{sport:additionalSports[index],code}}));
  }
}
