import {readFile,writeFile}from 'node:fs/promises';
import {createHash}from 'node:crypto';
import {parseResult}from '../server/results.js';
import {calibratedProbability,eloProbability,fitCalibration,modelMetrics,playerKey,updateRatings,type MatchResult,type Rating}from '../src/domain/player-model.js';

const file=process.argv[process.argv.indexOf('--archive')+1];
if(!file||!process.argv.includes('--archive'))throw new Error('ARCHIVE_FILE_REQUIRED');
const raw=JSON.parse(await readFile(file,'utf8'));
if(raw.source!=='postgres'||!Array.isArray(raw.results))throw new Error('ARCHIVE_INCOMPLETE');
const generated=Date.now();
const byId=new Map<string,MatchResult>();
for(const input of raw.results){const r=parseResult(input,generated);if(r)byId.set(r.id,r);}
const results=[...byId.values()].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt));
const leagues=['Czech Liga Pro','TT Elite Series','Setka Cup','TT Cup'];
const targets:MatchResult[]=[];
for(const league of leagues){const rows=results.filter(r=>r.league===league&&Date.parse(r.finishedAt)>generated-60*3600000).sort((a,b)=>Date.parse(a.finishedAt)-Date.parse(b.finishedAt));
 const n=Math.min(80,rows.length);for(let i=0;i<n;i++)targets.push(rows[Math.floor(i*(rows.length-1)/Math.max(1,n-1))]);}
const starts:{match:MatchResult;at:number}[]=[];let requested=0;
for(const target of targets){
 const began=Date.now();
 try{const url=new URL('https://moviodds.com/closing');url.searchParams.set('fi',target.id);
  const response=await fetch(url,{signal:AbortSignal.timeout(6000),redirect:'error',headers:{Accept:'application/json'}});
  if(response.ok){const p=await response.json() as Record<string,unknown>;
   const at=Date.parse(String(p.kickoff_utc))-60_000;
   const names=JSON.stringify(p.selections??[]);
   if(p.closed===true&&p.kickoff_known===true&&p.kickoff_estimated===false
    &&(p.fixture_id===target.id||(Array.isArray(p.fixture_ids)&&p.fixture_ids.includes(target.id)))
    &&Number.isFinite(at)&&at<Date.parse(target.finishedAt)&&Date.parse(target.finishedAt)-at<6*3600000
    &&names.includes(target.home)&&names.includes(target.away))starts.push({match:target,at});
  }
 }catch{/* Missing history is excluded, never imputed. */}
 requested++;if(requested%20===0)console.info(JSON.stringify({closingRequests:requested,knownStarts:starts.length,total:targets.length}));
 // Under the documented 120/minute public closing limit, without retries.
 await new Promise(r=>setTimeout(r,Math.max(0,700-(Date.now()-began))));
}
starts.sort((a,b)=>a.at-b.at);
const ratings:Record<string,Rating>={};let index=0;
const predictions:{p:number;y:number;league:string;at:number;available:number}[]=[];
for(const target of starts){
 while(index<results.length&&Date.parse(results[index].availableAt)<target.at)updateRatings(ratings,results[index++]);
 const a=ratings[playerKey(target.match.league,target.match.home)],b=ratings[playerKey(target.match.league,target.match.away)];
 if(!a||!b||Math.min(a.count,b.count)<20)continue;
 predictions.push({p:eloProbability(a.rating,b.rating),y:target.match.homeWon?1:0,league:target.match.league,at:target.at,available:Date.parse(target.match.availableAt)});
}
const split=Math.floor(predictions.length*.4),boundary=predictions[split]?.at??Infinity;
const calibrationRows=predictions.slice(0,split).filter(p=>p.available<boundary);
const test=predictions.slice(split);
const calibration=calibrationRows.length>=40?fitCalibration(calibrationRows):{a:1,b:0};
const adjusted=test.map(p=>({...p,p:calibratedProbability(p.p,calibration.a,calibration.b)}));
const validation=modelMetrics(adjusted);
const passes=(m:ReturnType<typeof modelMetrics>,n:number)=>m.n>=n&&m.brier!==null&&m.brier<.25&&m.logLoss!==null&&m.logLoss<Math.log(2)&&m.ece!==null&&m.ece<.15;
const leagueMetrics=Object.fromEntries(leagues.map(league=>{const metrics=modelMetrics(adjusted.filter(p=>p.league===league));return[league,{...metrics,eligible:passes(metrics,30)}];}));
while(index<results.length)updateRatings(ratings,results[index++]);
const validated=calibrationRows.length>=40&&passes(validation,100);
const cutoff=results.at(-1)?.availableAt??null;
const report={version:'elo-v1',generatedAt:new Date().toISOString(),trainingCutoff:cutoff,
 datasetHash:createHash('sha256').update(JSON.stringify(results)).digest('hex'),source:'MoviOdds results and closing; independent official confirmation unavailable',
 method:'Elo K=20, initial 1500, exact normalized names within league; chronological available_at training; calibration purged before temporal holdout',
 requestedStarts:requested,knownStarts:starts.length,usablePredictions:predictions.length,calibrationSamples:calibrationRows.length,
 calibrationOutcomeCutoff:calibrationRows.length?new Date(Math.max(...calibrationRows.map(p=>p.available))).toISOString():null,
 testStart:test.length?new Date(test[0].at).toISOString():null,testEnd:test.length?new Date(test.at(-1)!.at).toISOString():null,
 validated,reason:validated?'Temporal holdout gates passed on provider data':'Insufficient sample or temporal holdout gates failed; no operative forecast',
 calibration,validation,leagues:leagueMetrics,ratingKeyFormat:"sha256",ratings:Object.fromEntries(Object.entries(ratings).map(([key,value])=>[createHash("sha256").update(key).digest("hex"),value]))};
await writeFile(new URL('../models/elo-v1.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.info(JSON.stringify({...report,ratings:undefined},null,2));
