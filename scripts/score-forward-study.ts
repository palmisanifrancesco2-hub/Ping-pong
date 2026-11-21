import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ResultsFeed} from '../server/results.js';
import {modelMetrics} from '../src/domain/player-model.js';
import {verifiedStart} from '../src/domain/research-source.js';
const input=process.argv[2],output=process.argv[3],manifestPath=process.argv[4];if(!input||!output||!manifestPath||input===output)throw Error('Usage: score-forward-study immutable-capture.json new-audit.json manifest.json');
const raw=await readFile(input,'utf8');const study=JSON.parse(raw) as {observedAt:string;predictions:{eventId:string;home:string;away:string;league:string;homeProbability:number;marketProbability:number}[]};
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));if(manifest.captureHash!==createHash('sha256').update(raw).digest('hex'))throw Error('CAPTURE_CHANGED');
const archive=await new ResultsFeed().archive();if(archive.source!=='postgres')throw Error('ARCHIVE_INCOMPLETE');
const byId=new Map(archive.results.map(r=>[r.id,r]));
const scored=[];let unknownStart=0,pending=0;let nextRequest=0;
for(const p of study.predictions){
 const r=byId.get(p.eventId);if(!r){pending++;continue;}
 if(r.home!==p.home||r.away!==p.away||r.league!==p.league)throw Error('IDENTITY_CHANGED');
 const slot=Math.max(Date.now(),nextRequest);nextRequest=slot+700;await new Promise(r=>setTimeout(r,Math.max(0,slot-Date.now())));
 const response=await fetch(`https://moviodds.com/closing?fi=${encodeURIComponent(r.id)}`,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw Error('CLOSING_UNAVAILABLE');
 const start=verifiedStart(await response.json(),r);
 if(start===null){unknownStart++;continue;}
 // verifiedStart returns one minute before actual kickoff; require capture before that instant.
 if(Date.parse(study.observedAt)>=start){unknownStart++;continue;}
 scored.push({id:p.eventId,p:p.homeProbability,market:p.marketProbability,y:Number(r.homeWon),availableAt:r.availableAt});
}
const report={captureHash:createHash('sha256').update(raw).digest('hex'),checkedAt:new Date().toISOString(),captured:study.predictions.length,pending,unknownStart,metrics:modelMetrics(scored),market:modelMetrics(scored.map(r=>({p:r.market,y:r.y}))),productionValidated:false,scored,reason:'Audit of one cohort only. Aggregate independent days and apply the predeclared protocol before validation.'};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.info(JSON.stringify({...report,scored:undefined},null,2));
