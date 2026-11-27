import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import protocol from '../research/protocol-v7.json' with {type:'json'};
import {featureRows,fitScore,predictScore,featureGroups,type FeatureRow,type LogisticModel} from '../src/domain/score-model.js';
import {DailyGlicko} from '../src/domain/glicko2.js';
import {pointToSet,matchSetDistribution,totalFeatures} from '../src/domain/set-model.js';
import {modelMetrics,type MatchResult} from '../src/domain/player-model.js';
import {splitPeriod,calibrateTemperature,scaleProbability,pairedDayBootstrap} from '../src/domain/model-comparison.js';
const text=await readFile(protocol.input,'utf8'),data=JSON.parse(text)as{results:MatchResult[];starts:{id:string;at:number}[]};
const previous=JSON.parse(await readFile('.research-data/3000-comparison-audit.json','utf8')) as {predictions:Record<string,{id:string}[]>};
const verified=new Set(previous.predictions['full:0.001'].map(r=>r.id));
const rows=featureRows(data.results,data.starts,protocol.minimumPlayerHistory),byResult=new Map(data.results.map(r=>[r.id,r]));
const glicko=new DailyGlicko(data.results),gp=new Map(rows.map(r=>[r.id,glicko.at(byResult.get(r.id)!,r.at).p]));
const clipped=(p:number)=>Math.min(1-1e-8,Math.max(1e-8,p));
const winnerNames=protocol.candidates;
type P={id:string;at:number;p:number;y:number};
const winnerPredictions:Record<string,P[]>=Object.fromEntries(winnerNames.map(n=>[n,[]]));
const marketPredictions:Record<string,{model:P[];markov:P[];baseline:P[]}>=Object.fromEntries(protocol.targets.slice(1).map(n=>[n,{model:[],markov:[],baseline:[]}])) as never;
function target(r:FeatureRow,name:string){const m=byResult.get(r.id)!;return name==='first-set'?Number(m.sets[0][0]>m.sets[0][1]):Number(m.sets.length>(name==='over-sets-3.5'?3.5:4.5));}
const folds=[];
for(let fold=0;fold<protocol.foldStarts.length;fold++){
 const start=Date.parse(protocol.foldStarts[fold]),end=Date.parse(protocol.foldStarts[fold+1]??protocol.endExclusive),split=splitPeriod(rows,start,end,protocol.calibrationDays);
 const test=split.test.filter(r=>verified.has(r.id));
 if(split.train.length<protocol.minimumTraining||split.calibration.length<protocol.minimumCalibration||!test.length)continue;
 const full=fitScore(split.train,featureGroups.full,.001),scores=fitScore(split.train,featureGroups.scores,.01);
 const raw=(name:string,r:FeatureRow)=>name==='full:0.001'?predictScore(full,r.x):name==='scores:0.01'?predictScore(scores,r.x):name==='glicko2'?gp.get(r.id)!:matchSetDistribution(name==='point-markov'?pointToSet(1/(1+Math.exp(-r.x[1]/5))):1/(1+Math.exp(-r.x[2]/2))).winner;
 const temperatures=Object.fromEntries(winnerNames.slice(0,5).map(n=>[n,calibrateTemperature(split.calibration.map(r=>({p:clipped(raw(n,r)),y:r.y})),protocol.temperatures)]));
 const predict=(n:string,r:FeatureRow)=>scaleProbability(clipped(raw(n,r)),temperatures[n]);
 const components=['full:0.001','scores:0.01','glicko2'];
 const weights=[];for(let a=0;a<=4;a++)for(let b=0;b<=4-a;b++)weights.push([a/4,b/4,(4-a-b)/4]);
 const best=weights.map(w=>({w,loss:modelMetrics(split.calibration.map(r=>({p:w.reduce((s,v,i)=>s+v*predict(components[i],r),0),y:r.y}))).logLoss!})).sort((a,b)=>a.loss-b.loss)[0].w;
 for(const r of test){for(const n of winnerNames){const p=n==='ensemble-equal'?components.reduce((s,c)=>s+predict(c,r)/3,0):n==='ensemble-calibrated'?components.reduce((s,c,i)=>s+best[i]*predict(c,r),0):predict(n,r);winnerPredictions[n].push({id:r.id,at:r.at,y:r.y,p});}}
 for(const name of protocol.targets.slice(1)){
  const transformed=(r:FeatureRow)=>({...r,x:name==='first-set'?r.x:totalFeatures(r.x),y:target(r,name)});
  const train=split.train.map(transformed),cal=split.calibration.map(transformed),model=fitScore(train,featureGroups.full,.01),temperature=calibrateTemperature(cal.map(r=>({p:predictScore(model,r.x),y:r.y})),protocol.temperatures);
  const baseline=(cal.reduce((s,r)=>s+r.y,0)+1)/(cal.length+2);
  for(const r of test){const s=pointToSet(1/(1+Math.exp(-r.x[1]/5))),d=matchSetDistribution(s),p=scaleProbability(predictScore(model,transformed(r).x),temperature),markov=name==='first-set'?s:name==='over-sets-3.5'?d.over35:d.over45;const c={id:r.id,at:r.at,y:target(r,name)};marketPredictions[name].model.push({...c,p});marketPredictions[name].markov.push({...c,p:markov});marketPredictions[name].baseline.push({...c,p:baseline});}
 }
 folds.push({fold,start:new Date(start).toISOString(),training:split.train.length,calibration:split.calibration.length,test:test.length,temperatures,ensembleWeights:best});
 console.info(JSON.stringify(folds.at(-1)));
}
const ranking=winnerNames.map(name=>({name,...modelMetrics(winnerPredictions[name]),versusFull:pairedDayBootstrap(winnerPredictions[name].map((r,i)=>({...r,baseline:winnerPredictions['full:0.001'][i].p})),10000,6)})).sort((a,b)=>a.brier!-b.brier!);
const markets=Object.entries(marketPredictions).map(([name,groups])=>{const metrics=modelMetrics(groups.model),baseline=modelMetrics(groups.baseline),paired=pairedDayBootstrap(groups.model.map((r,i)=>({...r,baseline:groups.baseline[i].p})),10000,3);return{name,metrics,baseline,markov:modelMetrics(groups.markov),paired,eligible:metrics.n>=500&&metrics.brier!<baseline.brier!&&metrics.logLoss!<baseline.logLoss!&&metrics.ece!<.08&&paired.upperAdjusted!==null&&paired.upperAdjusted<0};});
const trainEnd=Date.parse('2026-11-03T00:00:00Z'),calEnd=Date.parse(protocol.endExclusive),train=rows.filter(r=>r.at<trainEnd&&r.available<trainEnd),cal=rows.filter(r=>r.at>=trainEnd&&r.at<calEnd&&r.available<calEnd);
const full=fitScore(train,featureGroups.full,.001),scores=fitScore(train,featureGroups.scores,.01);
const components=['full:0.001','scores:0.01','glicko2'];
const rawFinal=(name:string,r:FeatureRow)=>name==='full:0.001'?predictScore(full,r.x):name==='scores:0.01'?predictScore(scores,r.x):gp.get(r.id)!;
const temperatures=Object.fromEntries(components.map(n=>[n,calibrateTemperature(cal.map(r=>({p:clipped(rawFinal(n,r)),y:r.y})),protocol.temperatures)]));
const marketModels=Object.fromEntries(protocol.targets.slice(1).map(name=>{const transform=(r:FeatureRow)=>({...r,x:name==='first-set'?r.x:totalFeatures(r.x),y:target(r,name)}),m=fitScore(train.map(transform),featureGroups.full,.01),t=calibrateTemperature(cal.map(transform).map(r=>({p:predictScore(m,r.x),y:r.y})),protocol.temperatures);return[name,{model:m,temperature:t}];}));
const audit={protocol,inputHash:createHash('sha256').update(text).digest('hex'),generatedAt:new Date().toISOString(),productionValidated:false,independent:false,ranking,markets,folds,winnerPredictions,marketPredictions};
await writeFile('.research-data/multi-model-v7-audit.json',JSON.stringify(audit),{flag:'wx'});
const {winnerPredictions:_w,marketPredictions:_m,...report}=audit;await writeFile('research/report-v7.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const artifact={version:'multi-research-v1',generatedAt:audit.generatedAt,trainingCutoff:new Date(Math.max(...train.map(r=>r.available))).toISOString(),calibrationCutoff:new Date(Math.max(...cal.map(r=>r.available))).toISOString(),full,scores,temperatures,marketModels,ranking,markets,validated:false,trainingSamples:train.length,calibrationSamples:cal.length,inputHash:audit.inputHash};
await writeFile('models/multi-research-v1.json',JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
console.info(JSON.stringify({cases:ranking[0].n,ranking:ranking.map(r=>({name:r.name,n:r.n,brier:r.brier,logLoss:r.logLoss,ece:r.ece})),markets:markets.map(r=>({name:r.name,n:r.metrics.n,brier:r.metrics.brier,baseline:r.baseline.brier,eligible:r.eligible})),productionValidated:false}));
