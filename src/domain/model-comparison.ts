import {modelMetrics} from './player-model.js';
export type TimedCase={id:string;at:number;available:number};
export function splitPeriod<T extends TimedCase>(rows:T[],start:number,end:number,calibrationDays=2){
 const boundary=start-calibrationDays*86400000;
 return{train:rows.filter(r=>r.at<boundary&&r.available<boundary),calibration:rows.filter(r=>r.at>=boundary&&r.at<start&&r.available<start),test:rows.filter(r=>r.at>=start&&r.at<end)};
}
export function scaleProbability(p:number,t:number){
 if(!Number.isFinite(p)||p<=0||p>=1||!Number.isFinite(t)||t<=0)throw Error('INVALID_PROBABILITY');
 return 1/(1+Math.exp(-t*Math.log(p/(1-p))));
}
export function calibrateTemperature(rows:{p:number;y:number}[],values:number[]){
 if(!rows.length||!values.length)throw Error('NO_CALIBRATION_DATA');
 return values.map(t=>({t,loss:modelMetrics(rows.map(r=>({y:r.y,p:scaleProbability(r.p,t)}))).logLoss!})).sort((a,b)=>a.loss-b.loss||a.t-b.t)[0].t;
}
export function validateCommonCases(groups:Record<string,{id:string}[]>){
 const arrays=Object.values(groups);if(!arrays.length)throw Error('NO_MODELS');
 const ids=arrays[0].map(r=>r.id);if(new Set(ids).size!==ids.length)throw Error('DUPLICATE_TEST_EVENT');
 for(const rows of arrays)if(rows.length!==ids.length||rows.some((r,i)=>r.id!==ids[i]))throw Error('INCOMPARABLE_COHORTS');
 return ids;
}
/** Random resampling estimates uncertainty only; it never creates forecasts or outcomes.
 * Fixed PRNG seed makes the diagnostic reproducible. Day dependence can remain. */
export function pairedDayBootstrap(rows:{at:number;p:number;baseline:number;y:number}[],replicates=10000,comparisons=15){
 const grouped=new Map<string,{sum:number;n:number}>();
 for(const r of rows){const day=new Date(r.at).toISOString().slice(0,10),g=grouped.get(day)??{sum:0,n:0};g.sum+=(r.p-r.y)**2-(r.baseline-r.y)**2;g.n++;grouped.set(day,g);}
 const clusters=[...grouped.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v);
 const n=rows.length;if(clusters.length<2)return{days:clusters.length,n,mean:null,lower95:null,upper95:null,lowerAdjusted:null,upperAdjusted:null};
 let seed=9042026;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const differences:number[]=[];
 for(let i=0;i<replicates;i++){let sum=0,count=0;for(let j=0;j<clusters.length;j++){const c=clusters[Math.floor(random()*clusters.length)];sum+=c.sum;count+=c.n;}differences.push(sum/count);}
 differences.sort((a,b)=>a-b);const q=(p:number)=>differences[Math.min(differences.length-1,Math.floor(p*differences.length))];
 return{days:clusters.length,n,mean:clusters.reduce((s,c)=>s+c.sum,0)/n,lower95:q(.025),upper95:q(.975),lowerAdjusted:q(.025/comparisons),upperAdjusted:q(1-.025/comparisons)};
}
