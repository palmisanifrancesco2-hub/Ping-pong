import {randomUUID} from 'node:crypto';
import { additionalSports, type IndividualSport } from '../src/shared/individual-sports.js';
import type { BlindSportSummary, BlindStudyReport } from '../src/shared/blind-study.js';
import type { Board, FeedMatch, FeedQuote } from '../src/shared/board.js';
import { marketIdentity, quoteStatus } from '../src/shared/board.js';
import { eloProbability, playerKey } from '../src/domain/player-model.js';
import { bookmakerWinnerPrices } from '../src/shared/quote-selection.js';
import { prematchBenchmark, verifiedStart } from '../src/domain/research-source.js';
import { fairMarketProbability } from '../src/shared/value-filter.js';
import { individualWinnerOffers, IndividualSports, singles } from './individual-sports.js';
import { ResultsFeed } from './results.js';
import { ForecastStore } from './forecast-store.js';
import { MoviOddsFeed, tableTennisWinnerGroup } from './moviodds.js';
import { ProspectiveStudy } from './prospective-study.js';
import { marketHash, studyUuid } from './research-integrity.js';
import { movioddsRequest } from './moviodds-request.js';
import { readSportResults, sportResults } from './sport-training.js';
import { scoreWinnerEstimate, runtimeVersion } from './score-signals.js';
import type { Env } from './auth.js';

const study='blind-winner-v1';
const rowName='Blind winner observation v1';
const sports=['table_tennis',...additionalSports] as const;
const minute=60_000, hour=60*minute;
const lead=2*minute, dailyLimit=400, archiveGrace=10*24*hour;
const weeklyStart=Date.parse('2026-11-24T15:00:00Z');
const weeklyEnd=Date.parse('2026-12-01T16:00:00Z');
const weeklyFollowup=weeklyEnd+48*hour;
const competitionKey=(league:string,name:string)=>playerKey(league,name);
const normalized=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export const blindStudyEnabled=(env:Env)=>env.APP_BLIND_STUDY_ENABLED===undefined
  ? env.VERCEL_ENV==='production'&&!!env.CRON_SECRET : env.APP_BLIND_STUDY_ENABLED==='1';
type Match=FeedMatch<IndividualSport>;
type History={id:string;home:string;away:string;league:string;finishedAt:string;availableAt:string;homeWon:boolean};
type Price = { odds:number; quoteAt:string };
export type FrozenWinner={
  sport:IndividualSport;id:string;home:string;away:string;league:string;seenAt:number;scheduledAt:number;
  model:string; homeProbability:number; selection:'home'|'away'|null; prices:{home:Price|null;away:Price|null}|null;
  closingComparable?:true;
};
type Outcome={winner:'home'|'away';finishedAt:string;availableAt:string;actualGuard:number|null;invalid:boolean;closing?:{homeOdds:number;awayOdds:number}};
type Row={id:string;created_at:string;parameters:{study:string;userId:string;forecast:FrozenWinner;hash:string;attempts:number;lastAttempt:number;outcome:Outcome|null}};
type Db=ReturnType<ForecastStore['db']>;
type Source={board:Board<IndividualSport>|null;results:History[];score?: (m:Match)=>number|undefined};

function sourceFailure(error:unknown) {
  const code=error instanceof Error?(typeof error.cause==='string'?error.cause:error.message):'';
  return /^(MOVIODDS|RESULTS|BLIND)_[A-Z0-9_]+$/.test(code)?code:'UNKNOWN';
}

function pairedPrices(m:Match,quotes:FeedQuote[],now:number):FrozenWinner['prices'] {
  if(!quotes.length||quotes.length>2||quotes.some(q=>marketIdentity(q)!==marketIdentity(quotes[0])))return null;
  if(quotes.some(q=>q.fixture_id!==m.id||q.phase==='inplay'||Date.parse(q.ts)>now||quoteStatus(m,q,now)!=='Letta di recente dalla fonte'))return null;
  const participants=new Map(quotes.map(q=>[normalized(q.side||q.label||''),q]));
  const a=participants.get(normalized(m.home)),b=participants.get(normalized(m.away));
  if(Number(!!a)+Number(!!b)!==quotes.length)return null;
  return {home:a?{odds:a.odds_dec,quoteAt:a.ts}:null,away:b?{odds:b.odds_dec,quoteAt:b.ts}:null};
}

export function freezeWinner(m:Match, now:number, p:number, model:string, quotes:FeedQuote[]):FrozenWinner|undefined {
  const starts=Date.parse(m.kickoff_utc??'');
  if(m.in_play||!Number.isFinite(starts)||starts-now<=lead||starts-now>26*hour||
      !Number.isFinite(p)||p<=0||p>=1||normalized(m.home)===normalized(m.away))return;
  const prices=pairedPrices(m,quotes,now);
  const closingComparable=m.sport==='table_tennis'&&prices?.home&&prices.away&&quotes.every(q=>q.market_id==='920000'&&!q.period);
  return {sport:m.sport,id:m.id,home:m.home,away:m.away,league:m.league,seenAt:now,scheduledAt:starts,
    model,homeProbability:p,selection:p===.5?null:p>.5?'home':'away',prices,...(closingComparable?{closingComparable:true as const}:{})};
}

export function buildElo(history:History[],at:number,identity=competitionKey) {
  const ratings=new Map<string,{elo:number;n:number}>();
  const initial={elo:1500,n:0};
  for(const r of [...history].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id))){
    if(!(Date.parse(r.availableAt)<at&&Date.parse(r.finishedAt)<at))continue;
    const h=identity(r.league,r.home),a=identity(r.league,r.away);
    if(!h||!a||h===a)continue;
    const home=ratings.get(h)??initial,away=ratings.get(a)??initial;
    const delta=24*(Number(r.homeWon)-eloProbability(home.elo,away.elo));
    ratings.set(h,{elo:home.elo+delta,n:home.n+1});
    ratings.set(a,{elo:away.elo-delta,n:away.n+1});
  }
  return (m:Match)=>{
    const home=ratings.get(identity(m.league,m.home)),away=ratings.get(identity(m.league,m.away));
    return home&&away&&Math.min(home.n,away.n)>=4 ? eloProbability(home.elo,away.elo) : undefined;
  };
}

function tennisIdentity(league:string,name:string) {
  const division=/\bWTA\b|\bITF W\d{2,3}\b/i.test(league) ? 'women'
    : /\bATP\b|\bITF M\d{2,3}\b/i.test(league) ? 'men' : undefined;
  const fullName=normalized(name);
  return division&&fullName.includes(' ') ? JSON.stringify([division,fullName]) : '';
}

export function settleObserved(f:FrozenWinner,result:History|undefined,created:number,now:number):Outcome|null {
  if(!result||result.id!==f.id||!Number.isFinite(created)||Date.parse(result.availableAt)>now||
      !Number.isFinite(Date.parse(result.availableAt))||normalized(result.league)!==normalized(f.league))return null;
  const order=normalized(f.home)===normalized(result.home)&&normalized(f.away)===normalized(result.away);
  const reverse=normalized(f.home)===normalized(result.away)&&normalized(f.away)===normalized(result.home);
  if(!order&&!reverse)return null;
  return {winner:result.homeWon===order?'home':'away',finishedAt:result.finishedAt,availableAt:result.availableAt,
    actualGuard:null,invalid:!Number.isFinite(Date.parse(result.finishedAt))||Date.parse(result.finishedAt)<=Math.max(created,f.seenAt)||created>=f.scheduledAt};
}

function eligible(row:Row) {
  const f=row.parameters.forecast;
  return row.parameters.study===study && marketHash(f)===row.parameters.hash;
}

export function blindSummary(rows:Row[], sport:IndividualSport):BlindSportSummary {
  const cases=rows.filter(row=>row.parameters.forecast.sport===sport);
  let exact=0,incorrect=0,verifiedExact=0,verifiedIncorrect=0,invalid=0,pending=0,paired=0,brier=0,marketBrier=0;
  for(const {parameters:{forecast:f,outcome:o}} of cases){
    if(!o){pending++;continue;}
    if(o.invalid){invalid++;continue;}
    const correct=f.selection===o.winner;
    if(f.selection!==null){if(correct)exact++;else incorrect++;}
    if(o.actualGuard===null)continue;
    if(f.selection!==null){if(correct)verifiedExact++;else verifiedIncorrect++;}
    const y=Number(o.winner==='home');
    if(f.prices?.home&&f.prices.away){
      const {home,away}=f.prices;
      paired++;brier+=(f.homeProbability-y)**2;
      marketBrier+=((1/home.odds)/(1/home.odds+1/away.odds)-y)**2;
    }
  }
  return {sport,recorded:cases.length,withPrice:cases.filter(r=>r.parameters.forecast.prices).length,pending,exact,incorrect,
    verifiedExact,verifiedIncorrect,invalid,brier:paired?brier/paired:null,marketBrier:paired?marketBrier/paired:null,paired};
}

function weeklyRows(rows:Row[]) {
  return rows.filter(({parameters:{forecast:f}})=>f.sport==='table_tennis'&&f.seenAt>=weeklyStart&&f.seenAt<weeklyEnd&&f.scheduledAt<weeklyEnd);
}

function weeklySummary(rows:Row[]) {
  let value=0, exact=0, units=0, closingPairs=0, betterThanClosing=0;
  for(const {parameters:{forecast:f,outcome:o}} of rows){
    if(!o||o.invalid||o.actualGuard===null||!f.selection||!f.prices?.home||!f.prices.away)continue;
    const price=f.prices[f.selection]!.odds;
    if(price<1.3||Math.max(f.homeProbability,1-f.homeProbability)*price<=1+1e-12)continue;
    value++;
    if(f.selection===o.winner){exact++;units+=price;}
    const fair=o.closing?fairMarketProbability(o.closing.homeOdds,o.closing.awayOdds):null;
    if(fair!==null){closingPairs++;if(price*(f.selection==='home'?fair:1-fair)>1+1e-12)betterThanClosing++;}
  }
  return {until:new Date(weeklyEnd).toISOString(),...blindSummary(rows,'table_tennis'),value,exactValue:exact,
    theoreticalRoi:value?units/value-1:null,closingPairs,betterThanClosing};
}

export class BlindStudy {
  private store:ForecastStore;
  private owner:ProspectiveStudy;
  private running?:Promise<unknown>;
  constructor(private env:Env,private now=Date.now,private feed:Pick<MoviOddsFeed,'board'>=new MoviOddsFeed(fetch,now,env),
    private results=new ResultsFeed(fetch,now,env),private additional=new IndividualSports(env,now),private fetcher=fetch,
    private weeklyFeed:Pick<MoviOddsFeed,'board'>=new MoviOddsFeed<'table_tennis'>(fetcher,now,env,undefined,tableTennisWinnerGroup)){
    this.store=new ForecastStore(env,now);
    this.owner=new ProspectiveStudy(env,now);
  }
  private async rows(db:Db,owner:string,from?:string){
    const rows:Row[]=[];
    for(let page=0;;page++){
      let request=db.from('model_versions').select('id,created_at,parameters').eq('name',rowName)
        .contains('parameters',{study,userId:owner}).order('created_at',{ascending:false}).order('id',{ascending:false})
        .range(page*1000,page*1000+999);
      if(from)request=request.gte('created_at',from);
      const reply=await request;
      if(reply.error||!reply.data)throw Error('BLIND_STUDY_READ_FAILED');
      rows.push(...(reply.data as unknown as Row[]).filter(eligible));
      if(reply.data.length<1000)break;
    }
    return rows;
  }
  async report(userId:string):Promise<BlindStudyReport>{
    const owner=await this.owner.ownerId();
    const enabled=blindStudyEnabled(this.env);
    const rows=await this.rows(this.store.db(),owner);
    return {enabled,canRun:userId===owner,scheduled:enabled&&this.env.VERCEL_ENV==='production'&&!!this.env.CRON_SECRET,
      checkedAt:new Date(this.now()).toISOString(),sports:sports.map(sport=>blindSummary(rows,sport)),
      weekly:weeklySummary(weeklyRows(rows))};
  }
  async run(userId?:string,deadline=this.now()+170_000,bootstrap=false){
    if(!blindStudyEnabled(this.env))return {status:'disabled'};
    const owner=await this.owner.ownerId();
    if(userId&&userId!==owner)throw Error('BLIND_STUDY_OWNER_ONLY');
    if(this.running)return this.running;
    this.running=this.execute(owner,deadline,bootstrap);
    try{return await this.running;}finally{this.running=undefined;}
  }
  async runWeekly(){
    if(this.env.VERCEL_ENV!=='production'||!blindStudyEnabled(this.env))return {status:'disabled'};
    if(this.now()<weeklyStart||this.now()>=weeklyFollowup)return {status:'window_closed'};
    const owner=await this.owner.ownerId();
    return this.execute(owner,this.now()+120_000,false,true);
  }
  private async source(sport:IndividualSport,weekly=false):Promise<Source>{
    if(sport==='table_tennis'){
      const [board,results]=await Promise.allSettled([(weekly?this.weeklyFeed:this.feed).board(),this.results.archive()]);
      if(board.status==='rejected')console.warn(JSON.stringify({weeklyStudyFeed:'board',code:sourceFailure(board.reason)}));
      if(results.status==='rejected'){
        console.warn(JSON.stringify({weeklyStudyFeed:'results',code:sourceFailure(results.reason)}));
        throw results.reason;
      }
      if(board.status==='rejected'&&!weekly)throw board.reason;
      const archive=results.value;
      if(archive.source!=='postgres'){
        if(!weekly||archive.source!=='memory')throw Error('BLIND_ARCHIVE_INCOMPLETE');
        console.warn(JSON.stringify({weeklyStudyFeed:'results',code:'BLIND_ARCHIVE_INCOMPLETE'}));
        return {board:null,results:archive.results};
      }
      return {board:board.status==='fulfilled'?board.value:null,results:archive.results,
        score:m=>scoreWinnerEstimate(m as FeedMatch,archive,this.now())?.homeProbability};
    }
    const [board,raw]=await Promise.all([this.additional.activeBoard(sport),readSportResults(sport,this.env,this.fetcher)]);
    const archive=sportResults(sport,raw,this.now());
    if(archive.source!=='postgres')throw Error('BLIND_ARCHIVE_INCOMPLETE');
    return {board,results:archive.rows.map(r=>({id:r.id,home:r.home,away:r.away,league:r.league,
      finishedAt:new Date(r.finished).toISOString(),availableAt:new Date(r.available).toISOString(),homeWon:r.won===1}))};
  }
  private async execute(owner:string,deadline:number,bootstrap:boolean,weekly=false){
    const db=this.store.db(), started=this.now(), isoStart=new Date(started).toISOString();
    const day=isoStart.slice(0,10), bucket=weekly?30:10;
    const slot=bootstrap?'bootstrap':`${weekly?'weekly:':''}${Math.floor(started/(bucket*minute))}`;
    const id=studyUuid(`${study}:${owner}:run:${slot}`);
    const claim=await db.from('model_versions').upsert({id,name:'Blind winner batch v1',version:`${study}:run:${owner}:${slot}`,
      training_cutoff:isoStart,validated:false,parameters:{study,userId:owner,started:isoStart}},{onConflict:'id',ignoreDuplicates:true}).select('id');
    if(claim.error)throw Error('BLIND_STUDY_CLAIM_FAILED');
    if(!claim.data?.length)return {status:'recent_run'};
    const leaseId=studyUuid(`${study}:${owner}:lease:${day}`), token=randomUUID();
    const lease=await db.from('model_versions').upsert({id:leaseId,name:'Blind winner lease v1',version:`${study}:lease:${owner}:${day}`,
      training_cutoff:isoStart,validated:false,parameters:{until:0}},{onConflict:'id',ignoreDuplicates:true});
    if(lease.error)throw Error('BLIND_STUDY_LEASE_FAILED');
    const locked=await db.from('model_versions').update({parameters:{until:deadline+minute,token}}).eq('id',leaseId)
      .lte('parameters->>until',String(this.now())).select('id');
    if(locked.error)throw Error('BLIND_STUDY_LEASE_FAILED');
    if(!locked.data?.length)return {status:'running'};
    try { return await this.collect(db,owner,deadline,started,day,weekly); }
    finally {
      const released=await db.from('model_versions').update({parameters:{until:0}}).eq('id',leaseId).eq('parameters->>token',token);
      if(released.error)console.warn('BLIND_STUDY_LEASE_RELEASE_FAILED');
    }
  }
  private async collect(db:Db,owner:string,deadline:number,started:number,day:string,weekly:boolean){
    const prior=await this.rows(db,owner,new Date(started-archiveGrace).toISOString());
    const bySport=new Map<IndividualSport,Source>();
    const feeds=weekly?(['table_tennis'] as const):sports;
    await Promise.all(feeds.map(async sport=>{
      try{bySport.set(sport,await this.source(sport,weekly));}catch(error){console.warn(JSON.stringify({blindStudySource:'unavailable',sport,code:sourceFailure(error)}));}
    }));
    const seen=new Set(prior.map(r=>JSON.stringify([r.parameters.forecast.sport,r.parameters.forecast.id])));
    if(weekly&&!bySport.has('table_tennis'))throw Error('WEEKLY_STUDY_SOURCE_UNAVAILABLE');
    const left=weekly ? (started<weeklyEnd?Infinity:0)
      : Math.max(0,dailyLimit-prior.filter(r=>new Date(r.parameters.forecast.seenAt).toISOString().slice(0,10)===day).length);
    // Round-robin across feeds, then earliest kickoff within each sport.
    const groups=feeds.map(sport=>{
      const source=bySport.get(sport);
      if(!source?.board)return [];
      const at=this.now(), elo=buildElo(source.results,at);
      const tennisElo=sport==='tennis' ? buildElo(source.results,at,tennisIdentity) : undefined;
      const finished=new Set(source.results.map(r=>r.id));
      if (at-Date.parse(source.board.checkedAt)>30_000||new Date(at).toISOString().slice(0,10)!==day) return [];
      return [...source.board.matches].sort((a,b)=>Date.parse(a.kickoff_utc??'')-Date.parse(b.kickoff_utc??'')).flatMap(match=>{
        if(match.in_play||finished.has(match.id)||seen.has(JSON.stringify([sport,match.id]))||
           (weekly&&!(Date.parse(match.kickoff_utc??'')<weeklyEnd))||
           (sport!=='table_tennis'&&!singles(match as FeedMatch<Exclude<IndividualSport,'table_tennis'>>)))return [];
        const ready=source.score?.(match);
        const local=elo(match);
        const p=ready??local??tennisElo?.(match);
        if(p===undefined)return [];
        const prices=sport==='table_tennis'?bookmakerWinnerPrices(match as FeedMatch,at)
          :individualWinnerOffers(match as FeedMatch<Exclude<IndividualSport,'table_tennis'>>,at);
        const f=freezeWinner(match,at,p,ready!==undefined?runtimeVersion:local!==undefined?'elo-league-k24-v1':'elo-tennis-tour-k24-v1',prices);
        return f?[f]:[];
      });
    });
    const candidates:FrozenWinner[]=[];
    for(let i=0;i<Math.max(0,...groups.map(g=>g.length))&&candidates.length<left;i++){
      for(const group of groups){if(group[i]&&candidates.length<left)candidates.push(group[i]);}
    }
    let captured=0,reported=0,verified=0;
    const capturedBySport=Object.fromEntries(sports.map(sport=>[sport,0]));
    let capturedWithPrice=0;
    for(let offset=0;offset<candidates.length&&this.now()<deadline-20_000;offset+=80){
      const batch=candidates.slice(offset,offset+80).filter(f=>this.now()<f.scheduledAt-lead);
      if(!batch.length)continue;
      const stored=await db.from('model_versions').upsert(batch.map(f=>({
        id:studyUuid(`${study}:${owner}:${f.sport}:${f.id}`),name:rowName,
        version:`${study}:${owner}:${f.sport}:${f.id}`,training_cutoff:new Date(f.seenAt).toISOString(),validated:false,
        parameters:{study,userId:owner,forecast:f,hash:marketHash(f),outcome:null,attempts:0,lastAttempt:0},
      })),{onConflict:'id',ignoreDuplicates:true}).select('id');
      if(stored.error)throw Error('BLIND_STUDY_WRITE_FAILED');
      const ids=new Set(stored.data?.map(row=>row.id));
      captured+=ids.size;
      for(const f of batch){
        if(!ids.has(studyUuid(`${study}:${owner}:${f.sport}:${f.id}`)))continue;
        capturedBySport[f.sport]++;
        if(f.prices)capturedWithPrice++;
      }
    }
    const resultMaps=new Map([...bySport].map(([sport,data])=>[sport,new Map(data.results.map(result=>[result.id,result]))]));
    let calls=0, next=0, closingAvailable=true;
    for(const row of (weekly?weeklyRows(prior):prior).reverse()){
      if(this.now()>=deadline-7_000)break;
      const {parameters:p}=row,f=p.forecast,r=resultMaps.get(f.sport)?.get(f.id);
      if(!r||p.outcome?.actualGuard!=null||p.outcome?.invalid)continue;
      const outcome=settleObserved(f,r,Date.parse(row.created_at),this.now());
      if(!outcome)continue;
      let attempts=p.attempts, lastAttempt=p.lastAttempt;
      if(!outcome.invalid&&closingAvailable&&calls<(weekly?4:16)&&attempts<2&&this.now()-lastAttempt>12*hour&&this.now()<deadline-10_000){
        if(this.now()<next)await new Promise(resolve=>setTimeout(resolve,next-this.now()));
        next=this.now()+2200;calls++;attempts++;lastAttempt=this.now();
        try{
          const response=await movioddsRequest(`https://moviodds.com/closing?fi=${encodeURIComponent(r.id)}`,
            {signal:AbortSignal.timeout(5500)},this.fetcher,this.env);
          if([401,403,429,503].includes(response.status))closingAvailable=false;
          if(response.ok){
            const payload=await response.json(), target={id:r.id,home:f.home,away:f.away,finishedAt:r.finishedAt};
            const at=verifiedStart(payload,target), recordedAt=Math.max(f.seenAt,Date.parse(row.created_at));
            if(at!==null){
              outcome.actualGuard=at;outcome.invalid=recordedAt>=at;
              const closing=f.closingComparable&&!outcome.invalid?prematchBenchmark(payload,target,at):null;
              if(closing&&Math.min(closing.homeAt,closing.awayAt)>recordedAt){
                outcome.closing={homeOdds:closing.homeOdds,awayOdds:closing.awayOdds};
              }
            }
          }
        }catch{}
      }
      if(p.outcome&&lastAttempt===p.lastAttempt&&marketHash(p.outcome)===marketHash(outcome))continue;
      const result=await db.from('model_versions').update({parameters:{...p,outcome,attempts,lastAttempt}}).eq('id',row.id)
        .eq('parameters->>hash',p.hash).eq('parameters->>lastAttempt',String(p.lastAttempt)).select('id');
      if(result.error)throw Error('BLIND_STUDY_SETTLEMENT_FAILED');
      if(result.data?.length){if(!p.outcome&&!outcome.invalid)reported++;if(outcome.actualGuard!==null&&!outcome.invalid)verified++;}
    }
    const summary={status:weekly&&!bySport.get('table_tennis')?.board?'settlement_only':'completed',captured,reported,verified,capturedBySport,capturedWithPrice,feeds:bySport.size,closingQueries:calls,checkedAt:new Date(started).toISOString()};
    if(weekly){
      const all=weeklyRows(await this.rows(db,owner,new Date(weeklyStart-60_000).toISOString()));
      console.info(JSON.stringify({weeklyPingPongRun:summary,weekly:weeklySummary(all)}));
    }else console.info(JSON.stringify({blindStudyRun:summary}));
    return summary;
  }
}
