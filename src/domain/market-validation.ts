import protocol from '../../research/prospective-markets-v9.json' with {type:'json'};
import {modelMetrics} from './player-model.js';
export {protocol as marketStudyProtocol};
export type MarketObservation={
  studyId:string;userId:string;id:string;home:string;away:string;league:string;at:number;kickoff:number;
  observedBoard:string;modelVersion:string;modelHash:string;protocolHash:string;featuresAvailable:number;
  x:number[];baseline:number[];eb:number[];p:number[];sampleSize:number;
};
export type MarketOutcome={status:'pending'|'settled'|'invalid';y?:number[];availableAt?:string;closingHash?:string;actualStart?:number;reason?:string};
export type MarketStudyCase={forecast:MarketObservation;forecastHash:string;outcome:MarketOutcome;attempts:number;lastAttempt?:number};

export function marketInterval(rows:{at:number;value:number}[],replicates=protocol.bootstrapReplicates){
  if(!rows.length)return{n:0,days:0,mean:null,lower:null,upper:null};
  const byDay=new Map<number,{sum:number;n:number}>();
  for(const r of rows){const key=Math.floor(r.at/86400000),g=byDay.get(key)??{sum:0,n:0};g.sum+=r.value;g.n++;byDay.set(key,g);}
  const days=[...byDay.keys()].sort((a,b)=>a-b),mean=rows.reduce((n,r)=>n+r.value,0)/rows.length;
  if(days.length<protocol.minimumDays)return{n:rows.length,days:days.length,mean,lower:null,upper:null};
  const span=days.at(-1)!-days[0]+1,groups=Array.from({length:span},(_,i)=>byDay.get(days[0]+i)??{sum:0,n:0});
  let seed=20261105;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const samples:number[]=[];
  for(let b=0;b<replicates;b++){
    let sum=0,n=0,used=0;
    while(used<span){const start=Math.floor(random()*(span-protocol.blockDays+1));for(let j=0;j<protocol.blockDays&&used<span;j++,used++){sum+=groups[start+j].sum;n+=groups[start+j].n;}}
    if(n)samples.push(sum/n);
  }
  samples.sort((a,b)=>a-b);
  const tail=protocol.familyAlpha/(protocol.targets.length*protocol.checkpoints.length*2);
  return{n:rows.length,days:days.length,mean,lower:samples[Math.floor(samples.length*tail)],upper:samples[Math.min(samples.length-1,Math.floor(samples.length*(1-tail)))]};
}

export function marketDescriptive(cases:MarketStudyCase[]){
  const settled=cases.filter(r=>r.outcome.status==='settled'&&r.outcome.y?.length===14);
  return protocol.targets.map((target,j)=>{
    let correct=0,wrong=0,undecided=0;
    for(const r of settled){
      const p=r.forecast.p[j];
      // Descriptive most-likely outcome, not an operational bet or an EV filter.
      // At exactly 50% there is no preferred selection; retain it in proper scores.
      if(p===.5)undecided++;else if(Number(p>.5)===r.outcome.y![j])correct++;else wrong++;
    }
    return{target,n:settled.length,correct,wrong,undecided,accuracy:correct+wrong?correct/(correct+wrong):null,
      model:modelMetrics(settled.map(r=>({p:r.forecast.p[j],y:r.outcome.y![j]}))),
      reference:modelMetrics(settled.map(r=>({p:r.forecast.baseline[j],y:r.outcome.y![j]})))};
  });
}

/** Check a fixed enrollment prefix, never the first N convenient settled cases. */
export function marketCheckpoint(cases:MarketStudyCase[],size:number,now:number){
  if(!protocol.checkpoints.includes(size))throw Error('MARKET_CHECKPOINT_UNDECLARED');
  const prefix=[...cases].sort((a,b)=>a.forecast.at-b.forecast.at||a.forecast.id.localeCompare(b.forecast.id)).slice(0,size);
  const closed=prefix.length===size&&now>=Math.max(...prefix.map(c=>c.forecast.kickoff))+7*86400000;
  const settled=prefix.filter(r=>r.outcome.status==='settled'&&r.outcome.y?.length===14),coverage=prefix.length?settled.length/prefix.length:0;
  const observedDays=new Set(prefix.map(r=>new Date(r.forecast.at).toISOString().slice(0,10))).size;
  const targets=marketDescriptive(prefix).map((score,j)=>{
    const interval=closed?marketInterval(prefix.map(r=>({at:r.forecast.at,value:r.outcome.status==='settled'&&r.outcome.y?.length===14?(r.forecast.p[j]-r.outcome.y[j])**2-(r.forecast.baseline[j]-r.outcome.y[j])**2:1}))):{n:prefix.length,days:observedDays,mean:null,lower:null,upper:null};
    const checks={closed,coverage:coverage>=protocol.minimumCoverage,days:observedDays>=protocol.minimumDays,
      brier:interval.upper!==null&&interval.upper<0,
      logLoss:score.model.logLoss!==null&&score.reference.logLoss!==null&&score.model.logLoss<score.reference.logLoss,
      calibration:score.model.ece!==null&&score.model.ece<protocol.maximumECE};
    return{...score,interval,checks,preliminaryPass:Object.values(checks).every(Boolean),operationallyValidated:false};
  });
  return{size,captured:prefix.length,settled:settled.length,coverage,observedDays,closed,targets};
}
