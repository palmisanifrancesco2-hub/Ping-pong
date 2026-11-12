import{ResultsFeed}from'../server/results.js';
import model from'../models/elo-v1.json' with{type:'json'};
try{const archive=await new ResultsFeed().archive();console.info(JSON.stringify({playerDataVerification:'success',source:archive.source,results:archive.results.length,rejected:archive.rejected,from:archive.from,to:archive.to,checkedAt:archive.checkedAt,modelValidated:model.validated,validation:model.validation}));}catch{console.error('PLAYER_DATA_VERIFICATION_FAILED');process.exitCode=1;}
