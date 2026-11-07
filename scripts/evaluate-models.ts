import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {researchRows,chooseCandidate,dayClusterDifference,candidates} from '../src/domain/model-research.js';
import {fitCalibration,calibratedProbability,modelMetrics,type MatchResult} from '../src/domain/player-model.js';
import protocol from '../research/protocol-v2.json';
import {verifiedStart,prematchBenchmark} from '../src/domain/research-source.js';
const input=process.argv[2],output=process.argv[3];if(!input||!output)throw Error('Usage: evaluate-models input.json report.json');
const raw=await readFile(input,'utf8');
const data=JSON.parse(raw) as {protocolHash:string;results:MatchResult[];starts:{id:string;at:number}[];requested:number;missing:number};
const protocolHash=createHash('sha256').update(JSON.stringify(protocol)).digest('hex');
if(data.protocolHash!==protocolHash)throw Error('PROTOCOL_CHANGED');
const resultsById=new Map(data.results.map(r=>[r.id,r]));
const confirmed:typeof data.starts=[];
const benchmarks=new Map<string,NonNullable<ReturnType<typeof prematchBenchmark>>>();
const sourceHash=createHash('sha256');
for(const start of data.starts){
 const target=resultsById.get(start.id);if(!target)continue;
 const text=await readFile(`${input}.cache/${start.id}.json`,'utf8');sourceHash.update(start.id).update(text);
 const payload=JSON.parse(text);
 if(verifiedStart(payload,target)!==start.at)continue;
 confirmed.push(start);const benchmark=prematchBenchmark(payload,target,start.at);if(benchmark)benchmarks.set(start.id,benchmark);
}
const rows=researchRows(data.results,confirmed,protocol.minimumPlayerHistory);
const selectionBoundary=Date.parse(protocol.selectionEnd),testBoundary=Date.parse(protocol.calibrationEnd);
const selection=rows.filter(r=>r.at>=Date.parse(protocol.targetFrom)&&r.at<selectionBoundary&&r.available<selectionBoundary);
const calibrationRows=rows.filter(r=>r.at>=selectionBoundary&&r.at<testBoundary&&r.available<testBoundary);
const final=rows.filter(r=>r.at>=testBoundary&&r.at<Date.parse(protocol.targetToExclusive));
const chosen=chooseCandidate(selection);
const calibration=calibrationRows.length>=40?fitCalibration(calibrationRows.map(r=>({p:r.p[chosen],y:r.y}))):{a:1,b:0};
const homeRate=(selection.reduce((n,r)=>n+r.y,0)+1)/(selection.length+2);
const tested=final.map(r=>({...r,p:calibratedProbability(r.p[chosen],calibration.a,calibration.b)}));
const priced=tested.filter(r=>benchmarks.has(r.id));
const marketComparison={samples:priced.length,model:modelMetrics(priced),market:modelMetrics(priced.map(r=>({p:benchmarks.get(r.id)!.probability,y:r.y}))),pairedDifference:dayClusterDifference(priced.map(r=>({...r,baseline:benchmarks.get(r.id)!.probability}))),status:'Supplemental diagnostic only, not used for candidate selection or profitability claims'};
const metrics=modelMetrics(tested);
const neutral=modelMetrics(tested.map(r=>({p:.5,y:r.y}))),home=modelMetrics(tested.map(r=>({p:homeRate,y:r.y})));
const neutralDifference=dayClusterDifference(tested.map(r=>({...r,baseline:.5})));
const homeDifference=dayClusterDifference(tested.map(r=>({...r,baseline:homeRate})));
const checks=[
 {label:'Almeno 200 casi di sviluppo',passed:selection.length>=200},
 {label:'Almeno 40 casi di calibrazione',passed:calibrationRows.length>=40},
 {label:'Almeno 200 casi nel test finale',passed:metrics.n>=protocol.acceptance.minimumFinalSamples},
 {label:'Almeno tre giorni nel test finale',passed:neutralDifference.days>=protocol.acceptance.minimumDays},
 {label:'Miglioramento Brier stabile rispetto a 50/50',passed:neutralDifference.upper95!==null&&neutralDifference.upper95<0},
 {label:'Miglioramento Brier stabile rispetto alla frequenza storica',passed:homeDifference.upper95!==null&&homeDifference.upper95<0},
 {label:'Log Loss migliore dei due riferimenti',passed:metrics.logLoss!==null&&metrics.logLoss<Math.min(neutral.logLoss??0,home.logLoss??0)},
 {label:'Errore di calibrazione inferiore a 0,08',passed:metrics.ece!==null&&metrics.ece<protocol.acceptance.maximumECE}
];
const passes=checks.every(c=>c.passed);
const report={protocol,protocolHash,dataHash:createHash('sha256').update(raw).digest('hex'),closingSourceHash:sourceHash.digest('hex'),generatedAt:new Date().toISOString(),
 source:'MoviOdds independent provider; results not independently certified',archiveResults:data.results.length,requestedStarts:data.requested,knownStarts:data.starts.length,missingStarts:data.missing,
 exactIdentityStarts:confirmed.length,usable:rows.length,selectionSamples:selection.length,calibrationSamples:calibrationRows.length,marketComparison,
 candidateSelection:Object.fromEntries(candidates.map(c=>[c,modelMetrics(selection.map(r=>({p:r.p[c],y:r.y})))])),chosen,calibration,metrics,accuracy:tested.length?tested.filter(r=>(r.p>=.5?1:0)===r.y).length/tested.length:null,baselines:{neutral,home,homeRate},
 checks,pairedDayDifferences:{neutral:neutralDifference,home:homeDifference},retrospectiveGatesPassed:passes,productionValidated:false,
 reasons:passes?['Retrospective gates passed; prospective point-in-time validation and odds comparison still required']:['Retrospective reliability gates failed; keep experimental'],
 daily:[...new Set(tested.map(r=>new Date(r.at).toISOString().slice(0,10)))].map(day=>({day,...modelMetrics(tested.filter(r=>new Date(r.at).toISOString().startsWith(day)))})),
 leagues:Object.fromEntries([...new Set(tested.map(r=>r.league))].map(league=>[league,modelMetrics(tested.filter(r=>r.league===league))])),
 limitations:['Historical availability reconstructed from provider timestamps, not own observation logs','Missing closing records excluded; selection bias possible','Some archive records previously used for original Elo training; future prospective test remains necessary','Supplemental closing-quote benchmark is reconstructed, not a realizable profitability test','No live, set or points forecast validation','Three daily clusters are a weak uncertainty estimate; repeated players are correlated'],
 finalPredictions:tested.map(r=>({eventId:r.id,at:new Date(r.at).toISOString(),p:r.p,y:r.y}))};
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.info(JSON.stringify({...report,finalPredictions:undefined},null,2));
