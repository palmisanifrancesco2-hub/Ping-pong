import {z} from 'zod';
import type{MatchResult}from '../src/domain/player-model.js';
const time=z.iso.datetime({offset:true});
const raw=z.object({fixture_id:z.string(),sport:z.literal('table_tennis'),home:z.string().min(1),away:z.string().min(1),league:z.string().min(1),status:z.string(),final_score:z.string(),finished_at:time,updated_at:time.optional(),periods:z.array(z.object({name:z.string(),score:z.string()})).optional()});
export function parseResult(input:unknown,now:number):MatchResult|null{
 const p=raw.safeParse(input);if(!p.success)return null;const m=p.data;if(m.status!=='finished'||m.home===m.away)return null;
 const finished=Date.parse(m.finished_at),available=Math.max(finished,Date.parse(m.updated_at??m.finished_at));if(available>now||finished>now)return null;
 const parts=m.periods?.length?m.periods.map(p=>p.score):m.final_score.split(',');
 const sets:[number,number][]=[];let aw=0,bw=0;
 for(const part of parts){const pair=/^(\d{1,3})-(\d{1,3})$/.exec(part.trim());if(!pair)return null;const a=Number(pair[1]),b=Number(pair[2]);if(Math.max(a,b)<11||Math.abs(a-b)<2||(Math.max(a,b)>11&&Math.abs(a-b)!==2))return null;sets.push([a,b]);if(a>b)aw++;else bw++;}
 const wins=Math.max(aw,bw);if(![3,4].includes(wins)||Math.min(aw,bw)>=wins)return null;
 let a=0,b=0;for(let i=0;i<sets.length;i++){if(a===wins||b===wins)return null;if(sets[i][0]>sets[i][1])a++;else b++;}
 const detailed=sets.map(s=>s.join('-')).join(',');if(m.final_score.includes(',')?m.final_score.replaceAll(' ','')!==detailed:m.final_score.replaceAll(' ','')!==`${aw}-${bw}`)return null;
 return{id:m.fixture_id,home:m.home,away:m.away,league:m.league,finishedAt:m.finished_at,availableAt:new Date(available).toISOString(),homeWon:aw>bw,sets};
}
export type ResultsArchive={results:MatchResult[];checkedAt:string;source:string;rejected:number;from:string|null;to:string|null};
export class ResultsFeed{
 private cached?:{at:number;data:ResultsArchive};private pending?:Promise<ResultsArchive>;private failedAt?:number;
 constructor(private fetcher:typeof fetch=fetch,private now=Date.now){}
 async archive(){if(this.cached&&this.now()-this.cached.at<300_000)return this.cached.data;if(this.failedAt&&this.now()-this.failedAt<30_000)throw new Error('RESULTS_COOLDOWN');if(this.pending)return this.pending;this.pending=this.read();try{return await this.pending;}finally{this.pending=undefined;}}
 private async read():Promise<ResultsArchive>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60_000);
  try{const response=await this.fetcher('https://moviodds.com/results?sport=table_tennis',{signal:controller.signal,redirect:'error',headers:{Accept:'application/json'},cache:'no-store'});if(!response.ok||!response.body)throw new Error('results');
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;try{for(;;){const c=await reader.read();if(c.done)break;bytes+=c.value.byteLength;if(bytes>20_000_000)throw new Error('results_size');chunks.push(c.value);}}finally{await reader.cancel().catch(()=>{});}
   const payload=z.object({source:z.enum(['postgres','memory']),results:z.array(z.unknown()).max(100_000)}).parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
   const byId=new Map<string,MatchResult>();const conflicts=new Set<string>();let rejected=0;
   for(const input of payload.results){const m=parseResult(input,this.now());if(!m){rejected++;continue;}const old=byId.get(m.id);if(old&&JSON.stringify(old)!==JSON.stringify(m)){conflicts.add(m.id);rejected++;}else byId.set(m.id,m);}
   const results=[...byId.values()].filter(m=>!conflicts.has(m.id)).sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt));
   const dates=results.map(r=>r.finishedAt).sort();const data={results,checkedAt:new Date(this.now()).toISOString(),source:payload.source,rejected,from:dates[0]??null,to:dates.at(-1)??null};
   this.cached={at:this.now(),data};this.failedAt=undefined;return data;
  }catch{this.failedAt=this.now();throw new Error('RESULTS_UNAVAILABLE');}finally{clearTimeout(timer);controller.abort();}
 }
}
