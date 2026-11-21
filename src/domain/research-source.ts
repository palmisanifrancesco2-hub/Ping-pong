import type {MatchResult} from './player-model.js';
const record=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
export function verifiedStart(payload:unknown,target:MatchResult){
 const p=record(payload);if(!p)return null;
 const at=Date.parse(String(p.kickoff_utc))-60000;
 const selections=Array.isArray(p.selections)?p.selections.map(record).filter(x=>x!==null):[];
 const names=new Set(selections.map(s=>s.side));
 if(p.closed!==true||p.kickoff_known!==true||p.kickoff_estimated!==false||!(p.fixture_id===target.id||(Array.isArray(p.fixture_ids)&&p.fixture_ids.includes(target.id)))||!Number.isFinite(at)||at>=Date.parse(target.finishedAt)||Date.parse(target.finishedAt)-at>=6*3600000||!names.has(target.home)||!names.has(target.away))return null;
 return at;
}
/** Closing data can contain observations after the requested prediction instant.
 * Only coherent, non-suspended prematch pairs timestamped before it are usable. */
export function prematchBenchmark(payload:unknown,target:MatchResult,at:number){
 const p=record(payload);if(!p||verifiedStart(p,target)!==at||p.pre_close_basis!=='kickoff')return null;
 const selections=Array.isArray(p.selections)?p.selections.map(record).filter(x=>x!==null):[];
 const quotes=selections.filter(s=>s.group_id==='920000'&&s.market_id==='920000'&&s.line==='To Win'&&(s.side===target.home||s.side===target.away)).map(s=>record(s.pre_close));
 if(quotes.length!==2||quotes.some(q=>!q))return null;
 const home=quotes.find(q=>q?.side===target.home),away=quotes.find(q=>q?.side===target.away);
 if(!home||!away||home.market_id!==away.market_id||home.period!==away.period)return null;
 for(const q of [home,away]){const ts=Date.parse(String(q.ts));if(q.suspended!==false||typeof q.odds_dec!=='number'||!Number.isFinite(q.odds_dec)||q.odds_dec<=1||!Number.isFinite(ts)||ts>at||at-ts>300000)return null;}
 const h=home.odds_dec as number,a=away.odds_dec as number;
 return{homeOdds:h,awayOdds:a,probability:(1/h)/(1/h+1/a)};
}
