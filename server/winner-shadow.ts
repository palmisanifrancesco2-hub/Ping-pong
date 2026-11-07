import {ForecastStore} from './forecast-store.js';
import {marketHash,studyUuid} from './research-integrity.js';
import {winnerProtocol as protocol,winnerProbabilities,winnerSummary,winnerCheckpoint,type WinnerCase} from '../src/domain/winner-comparison.js';
import {quoteStatus,type Board} from '../src/shared/board.js';
import {playerKey} from '../src/domain/player-model.js';
import type {MarketStudyCase} from '../src/domain/market-validation.js';
import type {Env} from './auth.js';

type Source={parameters:{case:MarketStudyCase}};
type Stored={id:string;created_at:string;parameters:WinnerCase&{studyId:string;userId:string}};
const caseName=`Winner shadow ${protocol.id}`,checkpointName=`Winner shadow checkpoints ${protocol.id}`,protocolHash=marketHash(protocol);

export function assertWinnerCase(c:WinnerCase){
  const f=c.forecast;
  if(f.studyId!==protocol.id||f.protocolHash!==protocolHash||marketHash(f)!==c.forecastHash||f.at<Date.parse(protocol.createdAt)||![f.at,f.kickoff,f.featuresAvailable,f.sampleSize,f.homeOdds,f.awayOdds,f.leagueProbability].every(Number.isFinite)||f.featuresAvailable>=f.at||f.x.length!==63||!f.x.every(Number.isFinite)||f.sampleSize<protocol.minimumPlayerHistory||protocol.candidates.some(id=>!Number.isFinite(f.probabilities[id])||f.probabilities[id]<=0||f.probabilities[id]>=1)||f.leagueProbability<0||f.leagueProbability>1||!(f.bookmakerProbability>0&&f.bookmakerProbability<1)||f.homeOdds<=1||f.awayOdds<=1||!['pending','settled','invalid'].includes(c.outcome.status)||(c.outcome.status==='settled'&&![0,1].includes(c.outcome.y!)))throw Error('WINNER_SHADOW_CORRUPT');
}

export function settleWinnerCase(c:WinnerCase,source:MarketStudyCase,registeredAt:number,now=Date.now()):WinnerCase{
  assertWinnerCase(c);const f=c.forecast;
  if(source.forecast.id!==f.id||source.forecastHash!==f.sourceHash)return c;
  if(source.outcome.status==='invalid')return{...c,outcome:{status:'invalid',reason:'source_observation_invalid',sourceHash:marketHash(source.outcome)}};
  if(source.outcome.status!=='settled'||source.outcome.y?.length!==14||source.outcome.actualStart===undefined)return c;
  if(!Number.isFinite(source.outcome.actualStart)||source.outcome.actualStart>now||!Number.isFinite(Date.parse(source.outcome.availableAt??''))||Date.parse(source.outcome.availableAt!)>now)return c;
  if(!Number.isFinite(registeredAt)||Math.max(f.at,registeredAt)>=source.outcome.actualStart-60000)return{...c,outcome:{status:'invalid',reason:'shadow_registered_too_late',sourceHash:marketHash(source.outcome)}};
  return{...c,outcome:{status:'settled',y:source.outcome.y[0],sourceHash:marketHash(source.outcome)}};
}

/** Every candidate is recorded at one instant on one causal feature vector. */
export function winnerCandidates(candidates:MarketStudyCase[],sources:Source[],board:Board,knownFinished:Set<string>,owner:string,at:number){
  if(at<Date.parse(protocol.createdAt)||!Number.isFinite(Date.parse(board.checkedAt))||at-Date.parse(board.checkedAt)>30000||Date.parse(board.checkedAt)>at+1000)return[];
  const sourceById=new Map(sources.map(r=>[r.parameters.case.forecast.id,r.parameters.case]));
  const byId=new Map(board.matches.map(m=>[m.id,m]));
  return candidates.flatMap(c=>{
    const f=c.forecast,source=sourceById.get(f.id),m=byId.get(f.id);
    if(!source||source.outcome.status!=='pending'||!m||knownFinished.has(f.id)||m.in_play||playerKey(m.league,m.home)!==playerKey(source.forecast.league,source.forecast.home)||playerKey(m.league,m.away)!==playerKey(source.forecast.league,source.forecast.away)||f.at!==at||f.kickoff-at<protocol.minimumLeadMinutes*60000||f.kickoff-at>protocol.maximumLeadHours*3600000)return[];
    const pair=m.quotes.filter(q=>q.fixture_id===m.id&&q.group_id==='920000'&&q.line==='To Win'&&(q.side===m.home||q.side===m.away)&&q.phase!=='inplay'&&Number.isFinite(q.odds_dec)&&q.odds_dec>1&&Date.parse(q.ts)<=at&&quoteStatus(m,q,at)==='Letta di recente dalla fonte');
    if(pair.length!==2||new Set(pair.map(q=>q.side)).size!==2||pair[0].market_id!==pair[1].market_id||pair[0].period!==pair[1].period||pair[0].market_key!==pair[1].market_key)return[];
    const home=pair.find(q=>q.side===m.home)!,away=pair.find(q=>q.side===m.away)!;
    const forecast={id:f.id,userId:owner,studyId:protocol.id,protocolHash,sourceHash:source.forecastHash,at,kickoff:f.kickoff,featuresAvailable:f.featuresAvailable,sampleSize:f.sampleSize,x:f.x,leagueProbability:f.baseline[0],probabilities:winnerProbabilities(f),bookmakerProbability:(1/home.odds_dec)/(1/home.odds_dec+1/away.odds_dec),homeOdds:home.odds_dec,awayOdds:away.odds_dec,homeQuoteAt:home.ts,awayQuoteAt:away.ts,readAt:board.checkedAt};
    return[{forecast,forecastHash:marketHash(forecast),outcome:{status:'pending' as const}}];
  }).sort((a,b)=>marketHash(`${protocol.id}:${a.forecast.id}`).localeCompare(marketHash(`${protocol.id}:${b.forecast.id}`)));
}

export class WinnerShadow{
  private store:ForecastStore;
  constructor(env:Env,private now=Date.now){this.store=new ForecastStore(env,now);}
  private async rows(owner:string){
    const all:Stored[]=[];
    for(let from=0;from<protocol.maximumCases;from+=1000){const r=await this.store.db().from('model_versions').select('id,created_at,parameters').eq('name',caseName).contains('parameters',{studyId:protocol.id,userId:owner}).order('created_at',{ascending:true}).order('id',{ascending:true}).range(from,from+999);if(r.error)throw Error('WINNER_SHADOW_READ_FAILED');all.push(...(r.data??[]) as unknown as Stored[]);if((r.data?.length??0)<1000)break;}
    for(const r of all){assertWinnerCase(r.parameters);if(r.parameters.forecast.userId!==owner)throw Error('WINNER_SHADOW_OWNER');}return all;
  }
  private async checks(owner:string){const r=await this.store.db().from('model_versions').select('parameters,created_at').eq('name',checkpointName).contains('parameters',{studyId:protocol.id,userId:owner}).order('created_at',{ascending:true}).limit(4);if(r.error)throw Error('WINNER_SHADOW_READ_FAILED');return r.data??[];}
  async report(owner:string){
    const rows=await this.rows(owner),cases=rows.map(r=>r.parameters),summary=winnerSummary(cases),checks=await this.checks(owner),ordered=[...cases].sort((a,b)=>a.forecast.at-b.forecast.at||a.forecast.id.localeCompare(b.forecast.id));
    return{protocol,...summary,checkpoints:checks.map(r=>{const p=r.parameters as {size:number;prefixHash:string;result:ReturnType<typeof winnerCheckpoint>};return{size:p.size,result:p.result,consistent:p.prefixHash===marketHash(ordered.slice(0,p.size)),sealedAt:r.created_at};}),automaticPromotion:false};
  }
  async capture(owner:string,candidates:WinnerCase[],deadline:number){
    if(deadline-this.now()<15000)return{captured:0,status:'deadline'};
    const rows=await this.rows(owner),seen=new Set(rows.map(r=>r.parameters.forecast.id));
    const selected=candidates.filter(c=>!seen.has(c.forecast.id)).slice(0,Math.min(protocol.maximumPerDay,protocol.maximumCases-rows.length));
    if(!selected.length)return{captured:0,status:'no_eligible_future_events'};
    const day=new Date(this.now()).toISOString().slice(0,10),db=this.store.db();
    const claim=await db.from('model_versions').insert({id:studyUuid(`${protocol.id}:batch:${owner}:${day}`),name:`Winner shadow batches ${protocol.id}`,version:day,training_cutoff:'2026-11-05T00:00:00Z',validated:false,parameters:{studyId:protocol.id,userId:owner,state:'claimed',expected:selected.length}});
    if(claim.error){if(claim.error.code==='23505')return{captured:0,status:'daily_batch_claimed'};throw Error('WINNER_SHADOW_CLAIM_FAILED');}
    if(deadline-this.now()<12000)return{captured:0,status:'deadline'};
    const saved=await db.from('model_versions').upsert(selected.map((c,i)=>({id:studyUuid(`${protocol.id}:case:${owner}:${c.forecast.id}`),name:caseName,version:`slot:${rows.length+i}`,training_cutoff:'2026-11-05T00:00:00Z',validated:false,parameters:{studyId:protocol.id,userId:owner,...c}})),{onConflict:'id',ignoreDuplicates:true}).select('id');
    if(saved.error)throw Error('WINNER_SHADOW_CAPTURE_FAILED');return{captured:saved.data?.length??0,status:'captured'};
  }
  async settle(owner:string,sources:Source[],deadline:number){
    const rows=await this.rows(owner),byId=new Map(sources.map(r=>[r.parameters.case.forecast.id,r.parameters.case])),db=this.store.db();let settled=0;
    for(const row of rows){
      if(deadline-this.now()<12000)break;
      const c=row.parameters,source=byId.get(c.forecast.id);if(!source||c.outcome.status==='invalid')continue;
      const next=settleWinnerCase(c,source,Date.parse(row.created_at),this.now());if(marketHash(next.outcome)===marketHash(c.outcome))continue;
      const saved=await db.from('model_versions').update({parameters:{studyId:protocol.id,userId:owner,...next}}).eq('id',row.id).eq('parameters->>forecastHash',c.forecastHash).eq('parameters->outcome->>status',c.outcome.status).select('id');if(saved.error)throw Error('WINNER_SHADOW_WRITE_FAILED');if(saved.data?.length){row.parameters={...c,...next};if(next.outcome.status==='settled')settled++;}
    }
    const checks=await this.checks(owner),exists=new Set(checks.map(r=>Number((r.parameters as {size:number}).size)));
    for(const size of protocol.checkpoints){
      if(rows.length<size||exists.has(size)||deadline-this.now()<15000)continue;
      const latest=await this.rows(owner),result=winnerCheckpoint(latest.map(r=>r.parameters),size,this.now());if(!result.closed)continue;
      const prefix=latest.map(r=>r.parameters).sort((a,b)=>a.forecast.at-b.forecast.at||a.forecast.id.localeCompare(b.forecast.id)).slice(0,size);
      const saved=await db.from('model_versions').insert({id:studyUuid(`${protocol.id}:checkpoint:${owner}:${size}`),name:checkpointName,version:String(size),training_cutoff:'2026-11-05T00:00:00Z',validated:false,parameters:{studyId:protocol.id,userId:owner,size,prefixHash:marketHash(prefix),result}});if(saved.error&&saved.error.code!=='23505')throw Error('WINNER_SHADOW_CHECKPOINT_FAILED');
    }
    return{settled};
  }
}
