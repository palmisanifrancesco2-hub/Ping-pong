import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseResult} from '../server/results.js';
import {verifiedStart} from '../src/domain/research-source.js';
import protocol from '../research/protocol-v2.json';
const archive=process.argv[2],out=process.argv[3];
if(!archive||!out)throw Error('Usage: collect-research archive.json output.json');
const raw=JSON.parse(await readFile(archive,'utf8'));
if(raw.source!=='postgres'||!Array.isArray(raw.results))throw Error('ARCHIVE_INCOMPLETE');
const map=new Map<string,ReturnType<typeof parseResult>>(),conflicts=new Set<string>();
for(const input of raw.results){const r=parseResult(input,Date.now());if(!r)continue;const old=map.get(r.id);if(old&&JSON.stringify(old)!==JSON.stringify(r))conflicts.add(r.id);else map.set(r.id,r);}
const results=[...map.values()].filter((r):r is NonNullable<typeof r>=>!!r&&!conflicts.has(r.id));
const eligible=results.filter(r=>r.finishedAt>=protocol.targetFrom&&r.finishedAt<protocol.targetToExclusive).sort((a,b)=>a.finishedAt.localeCompare(b.finishedAt)||a.id.localeCompare(b.id));
const n=Math.min(protocol.maxTargets,eligible.length);
const targets=Array.from({length:n},(_,i)=>eligible[Math.floor(i*(eligible.length-1)/Math.max(1,n-1))]);
await mkdir(`${out}.cache`,{recursive:true});
let cursor=0,known=0,missing=0;
let nextRequest=0;
const starts:{id:string;at:number}[]=[];
async function worker(){while(cursor<targets.length){const target=targets[cursor++];let p:Record<string,unknown>|null=null;
try{p=JSON.parse(await readFile(`${out}.cache/${target.id}.json`,'utf8'));}catch{
 // Global admission spacing, at most 86 requests/minute across all workers.
 const slot=Math.max(Date.now(),nextRequest);nextRequest=slot+700;
 await new Promise(r=>setTimeout(r,Math.max(0,slot-Date.now())));
 try{const response=await fetch(`https://moviodds.com/closing?fi=${encodeURIComponent(target.id)}`,{signal:AbortSignal.timeout(12000),redirect:'error'});if(response.status===429)throw Error('RATE_LIMIT');if(response.ok){p=await response.json() as Record<string,unknown>;await writeFile(`${out}.cache/${target.id}.json`,JSON.stringify(p));}}catch(e){if(e instanceof Error&&e.message==='RATE_LIMIT')throw e;}
}
const at=verifiedStart(p,target);
if(at!==null){starts.push({id:target.id,at});known++;}else missing++;
if((known+missing)%50===0)console.info(JSON.stringify({processed:known+missing,known,missing,total:n}));
}}
await Promise.all([worker(),worker(),worker(),worker()]);
starts.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
await writeFile(out,JSON.stringify({protocolHash:createHash('sha256').update(JSON.stringify(protocol)).digest('hex'),collectedAt:new Date().toISOString(),source:'MoviOdds',results,starts,requested:n,missing}));
console.info(JSON.stringify({output:out,known,missing}));
