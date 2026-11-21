import full from '../../models/score-runtime-v1.json' with {type:'json'};
import multi from '../../models/multi-research-v1.json' with {type:'json'};
import context from '../../models/winner-context-v8.json' with {type:'json'};
import protocol from '../../research/winner-challengers-v10.json' with {type:'json'};
import {predictScore} from './score-model.js';
import {modelMetrics} from './player-model.js';
import {marketInterval,type MarketStudyCase} from './market-validation.js';
export {protocol as winnerProtocol};
export const winnerLabels:Record<string,string>={'current-eb':'Frequenze regolarizzate · candidato attuale','full-logistic':'Logistica completa · modello delle quote','scores-logistic':'Logistica su punti e set','context-logistic':'Logistica con statistiche specifiche'};
export type WinnerProbabilities=Record<string,number>;
const clamp=(p:number)=>Math.max(1e-9,Math.min(1-1e-9,p));
export function contextWinner(x:number[],baseline:number){
  if(x.length!==63||!x.every(Number.isFinite)||!Number.isFinite(baseline)||baseline<0||baseline>1)throw Error('WINNER_FEATURES_INVALID');
  const z=context.intercept+x.reduce((s,v,i)=>s+context.weights[i]*(v-context.mean[i])/context.scale[i],0);
  const raw=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
  return clamp(baseline+context.shrink*(raw-baseline));
}
export function winnerProbabilities(f:{x:number[];p:number[];baseline:number[]}):WinnerProbabilities{
  if(f.x.length!==63||!f.x.every(Number.isFinite)||f.baseline.length<1||f.p.length<1||![f.baseline[0],f.p[0]].every(p=>Number.isFinite(p)&&p>=0&&p<=1))throw Error('WINNER_FEATURES_INVALID');
  const x=f.x.slice(0,8);
  return{'current-eb':f.p[0],'full-logistic':predictScore(full.model,x,full.temperature),'scores-logistic':predictScore(multi.scores,x,multi.temperatures['scores:0.01']),'context-logistic':contextWinner(f.x,f.baseline[0])};
}
type Scored={p:number;y:number};
export function winnerScore(rows:Scored[]){
  let correct=0,wrong=0,undecided=0;
  for(const r of rows){if(r.p===.5)undecided++;else if(Number(r.p>.5)===r.y)correct++;else wrong++;}
  return{...modelMetrics(rows),correct,wrong,undecided,accuracy:correct+wrong?correct/(correct+wrong):null};
}
/** Post-hoc replay of exactly the known development cohort; never promotion evidence. */
export function winnerDiagnostic(cases:MarketStudyCase[]){
  const cutoff=Date.parse(protocol.diagnosticCutoff);
  const rows=cases.filter(c=>c.outcome.status==='settled'&&c.outcome.y?.length===14&&c.lastAttempt!==undefined&&c.lastAttempt<=cutoff);
  const replay=rows.map(c=>({c,ps:winnerProbabilities(c.forecast),y:c.outcome.y![0]}));
  return{cutoff:protocol.diagnosticCutoff,expected:protocol.diagnosticExpectedCases,n:rows.length,exploratory:true,validated:false,
    models:protocol.candidates.map(id=>({id,label:winnerLabels[id],...winnerScore(replay.map(r=>({p:r.ps[id],y:r.y})))})),
    reference:winnerScore(rows.map(c=>({p:c.forecast.baseline[0],y:c.outcome.y![0]}))),
    leagues:[...new Set(rows.map(c=>c.forecast.league))].sort().map(league=>({league,...winnerScore(rows.filter(c=>c.forecast.league===league).map(c=>({p:c.forecast.p[0],y:c.outcome.y![0]})))})),
    confidence:[{from:.5,to:.55},{from:.55,to:.6},{from:.6,to:1.00001}].map(bin=>{
      const members=rows.filter(c=>{const p=Math.max(c.forecast.p[0],1-c.forecast.p[0]);return p>=bin.from&&p<bin.to;});
      return{...bin,...winnerScore(members.map(c=>({p:c.forecast.p[0],y:c.outcome.y![0]})))};
    })};
}

export type WinnerObservation={id:string;userId:string;studyId:string;protocolHash:string;sourceHash:string;at:number;kickoff:number;featuresAvailable:number;sampleSize:number;x:number[];leagueProbability:number;probabilities:WinnerProbabilities;bookmakerProbability:number;homeOdds:number;awayOdds:number;homeQuoteAt:string;awayQuoteAt:string;readAt:string};
export type WinnerCase={forecast:WinnerObservation;forecastHash:string;outcome:{status:'pending'|'settled'|'invalid';y?:number;reason?:string;sourceHash?:string}};
export function winnerSummary(cases:WinnerCase[]){
  const settled=cases.filter(c=>c.outcome.status==='settled'&&[0,1].includes(c.outcome.y!));
  return{captured:cases.length,settled:settled.length,pending:cases.filter(c=>c.outcome.status==='pending').length,invalid:cases.filter(c=>c.outcome.status==='invalid').length,observedDays:new Set(cases.map(c=>new Date(c.forecast.at).toISOString().slice(0,10))).size,
    models:protocol.candidates.map(id=>({id,label:winnerLabels[id],...winnerScore(settled.map(c=>({p:c.forecast.probabilities[id],y:c.outcome.y!})))})),
    league:winnerScore(settled.map(c=>({p:c.forecast.leagueProbability,y:c.outcome.y!}))),bookmaker:winnerScore(settled.map(c=>({p:c.forecast.bookmakerProbability,y:c.outcome.y!}))),validated:false};
}
export function winnerCheckpoint(cases:WinnerCase[],size:number,now:number){
  if(!protocol.checkpoints.includes(size))throw Error('WINNER_CHECKPOINT_INVALID');
  const prefix=[...cases].sort((a,b)=>a.forecast.at-b.forecast.at||a.forecast.id.localeCompare(b.forecast.id)).slice(0,size),summary=winnerSummary(prefix);
  const closed=prefix.length===size&&now>=Math.max(...prefix.map(c=>c.forecast.kickoff))+protocol.settlementGraceDays*86400000;
  const coverage=prefix.length?summary.settled/prefix.length:0;
  const challengers=protocol.challengers.map(id=>{
    const scores=summary.models.find(m=>m.id===id)!;
    const comparisons=['league','incumbent','bookmaker'].map(reference=>{
      const baseline=(c:WinnerCase)=>reference==='league'?c.forecast.leagueProbability:reference==='incumbent'?c.forecast.probabilities['current-eb']:c.forecast.bookmakerProbability;
      const available=prefix.filter(c=>c.outcome.status==='settled');
      const refScore=winnerScore(available.map(c=>({p:baseline(c),y:c.outcome.y!})));
      const interval=closed?marketInterval(prefix.map(c=>({at:c.forecast.at,value:c.outcome.status==='settled'?(c.forecast.probabilities[id]-c.outcome.y!)**2-(baseline(c)-c.outcome.y!)**2:1})),protocol.bootstrapReplicates,protocol.familyComparisons):{n:prefix.length,days:summary.observedDays,mean:null,lower:null,upper:null};
      return{reference,metrics:refScore,interval,brierImproved:interval.upper!==null&&interval.upper<0,logLossImproved:scores.logLoss!==null&&refScore.logLoss!==null&&scores.logLoss<refScore.logLoss};
    });
    return{id,comparisons,preliminaryPass:closed&&coverage>=protocol.minimumCoverage&&summary.observedDays>=protocol.minimumDays&&scores.ece!==null&&scores.ece<protocol.maximumECE&&comparisons.every(c=>c.brierImproved&&c.logLossImproved),operationallyValidated:false};
  });
  return{size,closed,coverage,summary,challengers};
}
