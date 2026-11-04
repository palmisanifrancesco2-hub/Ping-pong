import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import protocol from '../research/protocol-v3.json';
import {featureRows,fitScore,predictScore,featureGroups} from '../src/domain/score-model.js';
import {modelMetrics,type MatchResult} from '../src/domain/player-model.js';
import {dayClusterDifference} from '../src/domain/model-research.js';
import {verifiedStart} from '../src/domain/research-source.js';
const previous=process.argv[2],holdout=process.argv[3],output=process.argv[4];if(!previous||!holdout||!output)throw Error('Usage: evaluate-score-models previous.json new-holdout.json report.json');
const old=JSON.parse(await readFile(previous,'utf8')) as {results:MatchResult[];starts:{id:string;at:number}[]};
const raw=await readFile(holdout,'utf8');const fresh=JSON.parse(raw) as typeof old&{protocolHash:string;requested:number;missing:number};
const protocolHash=createHash('sha256').update(JSON.stringify(protocol)).digest('hex');if(fresh.protocolHash!==protocolHash)throw Error('PROTOCOL_CHANGED');
if(fresh.starts.some(s=>old.starts.some(o=>o.id===s.id)))throw Error('HOLDOUT_EVENT_REUSE');
const confirmed:typeof fresh.starts=[];
for(const s of fresh.starts){const target=fresh.results.find(r=>r.id===s.id);if(!target)continue;const p=JSON.parse(await readFile(`${holdout}.cache/${s.id}.json`,'utf8'));if(verifiedStart(p,target)===s.at)confirmed.push(s);}
const rows=featureRows(old.results,old.starts,protocol.minimumPlayerHistory);
const trainEnd=Date.parse(protocol.trainEnd),selectionEnd=Date.parse(protocol.selectionEnd),calEnd=Date.parse(protocol.calibrationEnd);
const train=rows.filter(r=>r.at<trainEnd&&r.available<trainEnd);
const selection=rows.filter(r=>r.at>=trainEnd&&r.at<selectionEnd&&r.available<selectionEnd);
const cal=rows.filter(r=>r.at>=selectionEnd&&r.at<calEnd&&r.available<calEnd);
if(train.length<50||selection.length<30)throw Error('INSUFFICIENT_DEVELOPMENT');
const choices=protocol.candidates.map(name=>{const[group,penalty]=name.split(':');const model=fitScore(train,featureGroups[group],Number(penalty));return{name,model,metrics:modelMetrics(selection.map(r=>({p:predictScore(model,r.x),y:r.y})))};}).sort((a,b)=>a.metrics.brier!-b.metrics.brier!||a.name.localeCompare(b.name));
const chosen=choices[0];
const temperature=cal.length>=40?[.25,.5,.75,1,1.25,1.5].map(t=>({t,loss:modelMetrics(cal.map(r=>({p:predictScore(chosen.model,r.x,t),y:r.y}))).logLoss!})).sort((a,b)=>a.loss-b.loss||a.t-b.t)[0].t:1;
const test=featureRows(fresh.results,confirmed,protocol.minimumPlayerHistory).filter(r=>r.at>=calEnd&&r.at<Date.parse(protocol.targetToExclusive));
const predictions=test.map(r=>({...r,p:predictScore(chosen.model,r.x,temperature)}));
const metrics=modelMetrics(predictions),neutral=modelMetrics(test.map(r=>({p:.5,y:r.y}))),elo=modelMetrics(test.map(r=>({p:r.elo,y:r.y})));
const neutralDifference=dayClusterDifference(predictions.map(r=>({...r,baseline:.5}))),eloDifference=dayClusterDifference(predictions.map(r=>({...r,baseline:r.elo})));
const checks=[{label:'Almeno 200 eventi nuovi nel test',passed:test.length>=200},{label:'Almeno tre giorni',passed:neutralDifference.days>=3},{label:'Almeno 40 casi di calibrazione',passed:cal.length>=40},{label:'Brier stabilmente migliore del 50/50',passed:neutralDifference.upper95!==null&&neutralDifference.upper95<0},{label:'Brier stabilmente migliore di Elo K=20',passed:eloDifference.upper95!==null&&eloDifference.upper95<0},{label:'Log Loss migliore di entrambi i riferimenti',passed:metrics.logLoss!==null&&metrics.logLoss<Math.min(neutral.logLoss??0,elo.logLoss??0)},{label:'Errore di calibrazione sotto 0,08',passed:metrics.ece!==null&&metrics.ece<.08}];
const report={protocol,protocolHash,dataHash:createHash('sha256').update(raw).digest('hex'),generatedAt:new Date().toISOString(),source:'MoviOdds, risultati non certificati indipendentemente',requested:fresh.requested,knownStarts:confirmed.length,trainingSamples:train.length,selectionSamples:selection.length,calibrationSamples:cal.length,chosen:chosen.name,model:chosen.model,temperature,candidates:choices.map(c=>({name:c.name,...c.metrics})),metrics,accuracy:predictions.length?predictions.filter(r=>(r.p>=.5?1:0)===r.y).length/predictions.length:null,baselines:{neutral,elo},differences:{neutral:neutralDifference,elo:eloDifference},checks,retrospectiveGatesPassed:checks.every(c=>c.passed),productionValidated:false,
 daily:[...new Set(test.map(r=>new Date(r.at).toISOString().slice(0,10)))].map(day=>({day,...modelMetrics(predictions.filter(r=>new Date(r.at).toISOString().startsWith(day)))})),
 finalPredictions:predictions.map(r=>({id:r.id,at:new Date(r.at).toISOString(),p:r.p,y:r.y})),reason:'Nuovi eventi di test, periodo già esplorato: nessuna certificazione indipendente. Conferma prospettica necessaria.'};
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.info(JSON.stringify({...report,finalPredictions:undefined},null,2));
