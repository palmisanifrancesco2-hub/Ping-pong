import{readFile,writeFile,mkdir,symlink,stat}from'node:fs/promises';
import{createHash}from'node:crypto';
import{parseResult}from'../server/results.js';
import{verifiedStart}from'../src/domain/research-source.js';
import{playerKey,type MatchResult}from'../src/domain/player-model.js';
import protocol from'../research/protocol-v5.json';
const archivePath=process.argv[2],out=process.argv[3];if(!archivePath||!out)throw Error('Usage: collect-5000 archive.json output.json');
const cache=out+'.cache';await mkdir(cache,{recursive:true});
const raw=JSON.parse(await readFile(archivePath,'utf8'));if(raw.source!=='postgres'||!Array.isArray(raw.results))throw Error('ARCHIVE_INCOMPLETE');
const results:MatchResult[]=[],ids=new Map<string,MatchResult>(),bad=new Set<string>();
for(const input of raw.results){const r=parseResult(input,Date.now());if(!r)continue;const old=ids.get(r.id);if(old&&JSON.stringify(old)!==JSON.stringify(r))bad.add(r.id);else ids.set(r.id,r);}
for(const r of ids.values())if(!bad.has(r.id))results.push(r);
const history=new Map<string,number[]>();for(const r of results)for(const name of[r.home,r.away]){const k=playerKey(r.league,name),v=history.get(k)??[];v.push(Date.parse(r.availableAt));history.set(k,v);}for(const v of history.values())v.sort((a,b)=>a-b);
const count=(key:string,at:number)=>{const v=history.get(key)??[];let lo=0,hi=v.length;while(lo<hi){const mid=(lo+hi)>>>1;if(v[mid]<at)lo=mid+1;else hi=mid;}return lo;};
const eligible=(r:MatchResult,at:number)=>Math.min(count(playerKey(r.league,r.home),at),count(playerKey(r.league,r.away),at))>=protocol.minimumPlayerHistory;
const begins=Date.parse(protocol.targetFrom),ends=Date.parse(protocol.endExclusive),training:{id:string;at:number}[]=[],test=new Map<string,{id:string;at:number}>(),known=new Set<string>();
for(const path of['/tmp/pingpong-research-v2.json','/tmp/pingpong-research-v3.json']){
 const old=JSON.parse(await readFile(path,'utf8'));for(const s of old.starts){const r=ids.get(s.id);if(!r)continue;const payload=JSON.parse(await readFile(`${path}.cache/${s.id}.json`,'utf8'));if(verifiedStart(payload,r)!==s.at)continue;known.add(s.id);try{await symlink(`${path}.cache/${s.id}.json`,`${cache}/${s.id}.json`);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
 if(s.at<begins)training.push(s);else if(s.at<ends&&eligible(r,s.at))test.set(s.id,s);
 }}
const digest=(id:string)=>createHash('sha256').update(id).digest('hex');
const targets=results.filter(r=>Date.parse(r.finishedAt)>=begins&&Date.parse(r.finishedAt)<ends&&!known.has(r.id)&&eligible(r,Date.parse(r.finishedAt)-6*3600000)).map(r=>({r,hash:digest(r.id)})).sort((a,b)=>a.hash.localeCompare(b.hash)).map(x=>x.r);
let processed=0,requested=0,missing=0,nextRequest=0;
async function save(status:string){const starts=[...training,...test.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));const data={protocolHash:digest(JSON.stringify(protocol)),collectedAt:new Date().toISOString(),source:'MoviOdds',results,starts,requested,missing,testCases:test.size,target:protocol.targetCases,status,processed,potential:targets.length};await writeFile(out,JSON.stringify(data));await writeFile(out+'.progress.json',JSON.stringify({...data,results:undefined,starts:undefined}));}
await save('collecting');console.info(JSON.stringify({cachedEligible:test.size,additionalCandidates:targets.length,target:protocol.targetCases}));
for(let i=0;i<targets.length&&test.size<protocol.targetCases;i+=4){
 const batch=targets.slice(i,i+4);
 const answers=await Promise.all(batch.map(async r=>{let p:unknown;try{p=JSON.parse(await readFile(`${cache}/${r.id}.json`,'utf8'));}catch{
  const slot=Math.max(Date.now(),nextRequest);nextRequest=slot+700;await new Promise(resolve=>setTimeout(resolve,Math.max(0,slot-Date.now())));
  const response=await fetch(`https://moviodds.com/closing?fi=${encodeURIComponent(r.id)}`,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'application/json'}});requested++;
  if(response.status===429||response.status===503)throw Error('RATE_LIMIT_OR_SOURCE_BUSY');if(!response.ok)return{r,at:null};p=await response.json();await writeFile(`${cache}/${r.id}.json`,JSON.stringify(p));
 }return{r,at:verifiedStart(p,r)};}));
 for(const {r,at}of answers){processed++;if(at!==null&&at>=begins&&at<ends&&eligible(r,at)){if(test.size<protocol.targetCases)test.set(r.id,{id:r.id,at});}else missing++;}
 if(processed%40===0||test.size>=protocol.targetCases){await save('collecting');console.info(JSON.stringify({processed,testCases:test.size,target:protocol.targetCases,requested,missing}));}
}
await save(test.size===protocol.targetCases?'ready':'insufficient');if(test.size!==protocol.targetCases)throw Error('INSUFFICIENT_VERIFIED_CASES');
// A second empty-start dataset keeps the existing common-comparison input contract.
await writeFile(out+'.empty.json',JSON.stringify({results,starts:[]}));await mkdir(out+'.empty.json.cache',{recursive:true});
console.info(JSON.stringify({status:'ready',testCases:test.size,output:out}));
