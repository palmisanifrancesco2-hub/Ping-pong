import model from'../models/elo-v1.json' with{type:'json'};
import type{ValueReport}from'../src/shared/value.js';
import{createHash}from'node:crypto';
import{calibratedProbability,eloProbability,playerKey,type Rating}from'../src/domain/player-model.js';
import{isUpcomingOrLive,quoteStatus,quoteIdentity,type Board}from'../src/shared/board.js';
import{rankValues,type ValueInput,type ValueOpportunity}from'../src/domain/value.js';
/** No synthetic candidates or substitution of bookmaker-implied prices for model estimates. */
export function currentValueReport(now=Date.now(),board?:Board):ValueReport{
  const reasons:string[]=[];
  if(!model.validated)reasons.push('Modello non validato: Brier 0,2515 su 118 test, peggiore del riferimento 0,25. Percentuali ed EV sotto sono stime sperimentali, non opportunità validate.');
  const rows:ValueInput[]=[];
  const age=now-Date.parse(model.generatedAt),cutoff=Date.parse(model.trainingCutoff);
  if(Number.isFinite(age)&&age>=0&&age<7*86400000&&cutoff<=now)for(const m of board?.matches??[]){
    if(m.in_play||!isUpcomingOrLive(m,now))continue;
    if(model.validated&&!model.leagues[m.league as keyof typeof model.leagues]?.eligible)continue;
    const ratings=model.ratings as Record<string,Rating>;
    const key=(name:string)=>createHash('sha256').update(playerKey(m.league,name)).digest('hex');
    const a=ratings[key(m.home)],b=ratings[key(m.away)];if(!a||!b||Math.min(a.count,b.count)<30)continue;
    const p=calibratedProbability(eloProbability(a.rating,b.rating),model.calibration.a,model.calibration.b),n=Math.min(a.count,b.count,200);
    const pair=m.quotes.filter(q=>q.fixture_id===m.id&&q.group_id==='920000'&&q.line==='To Win'&&(q.side===m.home||q.side===m.away)&&quoteStatus(m,q,now)==='Letta di recente dalla fonte'&&Date.parse(q.ts)<=now);
    if(pair.filter(q=>q.side===m.home).length!==1||pair.filter(q=>q.side===m.away).length!==1)continue;
    if(pair[0].market_id!==pair[1].market_id||pair[0].period!==pair[1].period||pair[0].market_key!==pair[1].market_key)continue;
    for(const q of pair){const probability=q.side===m.home?p:1-p;const lower=Math.max(0,probability-1.96*Math.sqrt(probability*(1-probability)/n)-model.validation.ece);
      rows.push({id:JSON.stringify([m.id,quoteIdentity(q)]),eventId:m.id,match:`${m.home} — ${m.away}`,competition:m.league,market:'Vincente partita prematch',selection:q.side!,odds:q.odds_dec,quoteAt:q.ts,probability,probabilityLower:lower,sampleSize:n,validationSize:model.validation.n,modelValidated:model.validated,fresh:true,admVerified:false});}
  }
  const experimental:ValueOpportunity[]=rows.filter(r=>!r.modelValidated&&r.odds>=1.3&&r.probabilityLower*r.odds>1).map(r=>({...r,impliedProbability:1/r.odds,fairOdds:1/r.probability,ev:r.probability*r.odds-1,conservativeEv:r.probabilityLower*r.odds-1,assessment:'Sperimentale' as const,rank:r.probabilityLower*r.odds-1})).sort((a,b)=>b.rank-a.rank);
  const opportunities=rankValues(rows);
  if(!opportunities.length&&!experimental.length)reasons.push('Nessuna quota fresca supera i controlli statistici e il margine prudente in questa rilevazione.');
  return{checkedAt:new Date(now).toISOString(),status:model.validated?'ready':'experimental',modelValidated:model.validated,admVerified:false,reasons,opportunities,experimental};
}
