import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import defaultProtocol from '../research/protocol-v4.json';
import {featureRows,fitScore,predictScore,featureGroups,type LogisticModel} from '../src/domain/score-model.js';
import {researchRows,type Candidate} from '../src/domain/model-research.js';
import {modelMetrics,type MatchResult} from '../src/domain/player-model.js';
import {splitPeriod,scaleProbability,calibrateTemperature,validateCommonCases,pairedDayBootstrap} from '../src/domain/model-comparison.js';
import {verifiedStart} from '../src/domain/research-source.js';
const [first,second,output,auditOutput]=process.argv.slice(2);if(!first||!second||!output||!auditOutput||output===auditOutput)throw Error('Usage: compare-models v2-data.json v3-data.json new-report.json private-audit.json');
const protocol=process.argv[6]?JSON.parse(await readFile(process.argv[6],'utf8')) as typeof defaultProtocol:defaultProtocol;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const texts=await Promise.all([readFile(first,'utf8'),readFile(second,'utf8')]);
const datasets=texts.map(t=>JSON.parse(t) as {results:MatchResult[];starts:{id:string;at:number}[]});
if(hash(JSON.stringify(datasets[0].results))!==hash(JSON.stringify(datasets[1].results)))throw Error('DIFFERENT_RESULT_SNAPSHOTS');
const starts:{id:string;at:number}[]=[],seen=new Set<string>(),byId=new Map(datasets[0].results.map(r=>[r.id,r]));
const closingHash=createHash('sha256');
for(let i=0;i<datasets.length;i++)for(const s of datasets[i].starts){
 if(seen.has(s.id))throw Error('DUPLICATE_INPUT_EVENT');seen.add(s.id);
 const target=byId.get(s.id);if(!target)throw Error('MISSING_RESULT');
 const text=await readFile(`${[first,second][i]}.cache/${s.id}.json`,'utf8');closingHash.update(s.id).update(text);
 if(verifiedStart(JSON.parse(text),target)!==s.at)throw Error('UNVERIFIED_START');starts.push(s);
}
const features=featureRows(datasets[0].results,starts,protocol.minimumPlayerHistory),eloRows=researchRows(datasets[0].results,starts,protocol.minimumPlayerHistory);
const eloById=new Map(eloRows.map(r=>[r.id,r.p]));if(features.length!==eloRows.length||features.some(r=>!eloById.has(r.id)))throw Error('FEATURE_COHORT_MISMATCH');
type Prediction={id:string;at:number;league:string;p:number;y:number;fold:number};
const predictions:Record<string,Prediction[]>=Object.fromEntries(protocol.candidates.map(c=>[c,[]]));
const folds=[];const artifacts=[];
for(let f=0;f<protocol.foldStarts.length;f++){
 const start=Date.parse(protocol.foldStarts[f]),end=Date.parse(protocol.foldStarts[f+1]??protocol.endExclusive);
 const split=splitPeriod(features,start,end,protocol.calibrationDays);
 if(split.train.length<protocol.minimumTraining||split.calibration.length<protocol.minimumCalibration||!split.test.length){folds.push({start:new Date(start).toISOString(),end:new Date(end).toISOString(),status:'skipped',training:split.train.length,calibration:split.calibration.length,test:split.test.length,metrics:{}});continue;}
 const foldMetrics:Record<string,ReturnType<typeof modelMetrics>>={};
 for(const name of protocol.candidates){
  let model:LogisticModel|undefined;
  if(name.includes(':')){const[group,lambda]=name.split(':');model=fitScore(split.train,featureGroups[group],Number(lambda));}
  const raw=(r:typeof features[number])=>model?predictScore(model,r.x):eloById.get(r.id)![name as Candidate];
  const temperature=calibrateTemperature(split.calibration.map(r=>({p:raw(r),y:r.y})),protocol.temperatures);
  const rows=split.test.map(r=>({id:r.id,at:r.at,league:r.league,y:r.y,p:scaleProbability(raw(r),temperature),fold:f}));
  predictions[name].push(...rows);foldMetrics[name]=modelMetrics(rows);
  artifacts.push({fold:f,name,model,temperature,trainingOutcomeCutoff:new Date(Math.max(...split.train.map(r=>r.available))).toISOString(),calibrationOutcomeCutoff:new Date(Math.max(...split.calibration.map(r=>r.available))).toISOString()});
 }
 folds.push({start:new Date(start).toISOString(),end:new Date(end).toISOString(),status:'evaluated',training:split.train.length,calibration:split.calibration.length,test:split.test.length,metrics:foldMetrics});
 console.info(JSON.stringify({fold:f+1,training:split.train.length,calibration:split.calibration.length,test:split.test.length}));
}
const ids=validateCommonCases(predictions);if(!ids.length)throw Error('NO_COMPARABLE_TESTS');
if('targetCases' in protocol&&ids.length!==protocol.targetCases)throw Error('TARGET_CASE_COUNT_NOT_MET');
const ranking=protocol.candidates.map(name=>{
 const rows=predictions[name],days=[...new Set(rows.map(r=>new Date(r.at).toISOString().slice(0,10)))];
 const daily=days.map(day=>({day,...modelMetrics(rows.filter(r=>new Date(r.at).toISOString().startsWith(day)))}));
 return{name,...modelMetrics(rows),accuracy:rows.filter(r=>(r.p>=.5?1:0)===r.y).length/rows.length,equalDayBrier:daily.reduce((s,d)=>s+d.brier!,0)/daily.length,daily};
}).sort((a,b)=>a.brier!-b.brier!||a.logLoss!-b.logLoss!||a.name.localeCompare(b.name));
const winner=ranking[0].name,secondPlace=ranking[1].name;
const paired=Object.fromEntries(protocol.candidates.filter(n=>n!==winner).map(n=>[n,pairedDayBootstrap(predictions[winner].map((r,i)=>({...r,baseline:predictions[n][i].p})))]));
const neutral=pairedDayBootstrap(predictions[winner].map(r=>({...r,baseline:.5})));
const robustWinner=Object.values(paired).every(p=>p.upperAdjusted!==null&&p.upperAdjusted<0)&&neutral.upperAdjusted!==null&&neutral.upperAdjusted<0;
const report={protocol,protocolHash:hash(JSON.stringify(protocol)),inputHashes:texts.map(hash),closingSourceHash:closingHash.digest('hex'),generatedAt:new Date().toISOString(),verifiedStarts:starts.length,usableCases:features.length,testCases:ids.length,testEventHash:hash(JSON.stringify(ids)),days:neutral.days,evaluatedFolds:folds.filter(f=>f.status==='evaluated').length,winner,secondPlace,equalDayWinner:[...ranking].sort((a,b)=>a.equalDayBrier-b.equalDayBrier)[0].name,robustWinner,productionValidated:false,ranking,neutral,paired,folds,artifacts,predictions,
 reason:robustWinner?'Primo nella ricerca retrospettiva; conferma indipendente necessaria':'Primo per punteggio storico, ma superiorità statistica non dimostrata',limitations:protocol.limitations};
const auditText=JSON.stringify(report,null,2)+'\n';
await writeFile(auditOutput,auditText,{flag:'wx'});
const {predictions:_predictions,artifacts:_artifacts,...summary}=report;
await writeFile(output,JSON.stringify({...summary,auditHash:hash(auditText)},null,2)+'\n',{flag:'wx'});
console.info(JSON.stringify({...report,ranking:ranking.map(({daily:_,...r})=>r),predictions:undefined,artifacts:undefined,paired:undefined,folds:undefined},null,2));
