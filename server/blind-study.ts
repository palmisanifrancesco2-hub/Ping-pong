import {randomUUID} from 'node:crypto';
import { additionalSports, type IndividualSport } from '../src/shared/individual-sports.js';
import {blindEvBands,type BlindAudit,type BlindEvBands,type BlindHistory,type BlindHistoryWeek,
  type BlindHighEv,type BlindSportSummary,type BlindStudyReport} from '../src/shared/blind-study.js';
import type { Board, FeedMatch, FeedQuote } from '../src/shared/board.js';
import { marketIdentity, quoteStatus } from '../src/shared/board.js';
import { eloProbability, playerKey } from '../src/domain/player-model.js';
import { bookmakerWinnerPrices } from '../src/shared/quote-selection.js';
import { prematchBenchmark, verifiedStart } from '../src/domain/research-source.js';
import { fairMarketProbability } from '../src/shared/value-filter.js';
import {oddsCalibration} from '../src/domain/odds-calibration.js';
import { disagreementReport, disagreementStartAt } from '../src/domain/underdog-study.js';
import { individualWinnerOffers, IndividualSports, singles } from './individual-sports.js';
import {marketEstimateReport,marketTarget} from './market-estimates.js';
import {archivedPricingPairs,confirmedBestOfFive,isSetka,pricingCoverage,pricingReport,pricingSnapshot,savePricingSnapshots,type PricingSnapshot} from './pricing-study.js';
import {marketPriceKey} from '../src/shared/additional-markets.js';
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
const week=7*24*hour;
const historyWindow=12*week;
const externalEloSlope=.851669859603553;
const historyStart=Date.parse('2026-11-16T00:00:00Z');
type CollectionMode='daily'|'weekly'|'history';

export function weeklyScanOverdue(lastSuccess:number, now:number) {
  return !Number.isFinite(lastSuccess)||lastSuccess<=0||now-lastSuccess>=45*minute;
}
const competitionKey=(league:string,name:string)=>playerKey(league,name);
const normalized=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export const blindStudyEnabled=(env:Env)=>env.APP_BLIND_STUDY_ENABLED===undefined
  ? env.VERCEL_ENV==='production'&&!!env.CRON_SECRET : env.APP_BLIND_STUDY_ENABLED==='1';
type Match=FeedMatch<IndividualSport>;
type History={id:string;home:string;away:string;league:string;finishedAt:string;availableAt:string;homeWon:boolean;sets?:[number,number][]};
type Price = { odds:number; quoteAt:string };
export type FrozenWinner={
  sport:IndividualSport;id:string;home:string;away:string;league:string;seenAt:number;scheduledAt:number;
  model:string; homeProbability:number; selection:'home'|'away'|null; prices:{home:Price|null;away:Price|null}|null;
  closingComparable?:true;
  peerHomeProbability?:number;
  marketBlend25HomeProbability?:number;
  externalEloCalibratedHomeProbability?:number;
  agreementBlendHomeProbability?:number;
};
type Outcome={winner:'home'|'away';finishedAt:string;availableAt:string;actualGuard:number|null;invalid:boolean;sets?:[number,number][];pricingClosing?:ReturnType<typeof archivedPricingPairs>;closing?:{homeOdds:number;awayOdds:number}};
type Row={id:string;created_at:string;parameters:{study:string;userId:string;forecast:FrozenWinner;hash:string;attempts:number;lastAttempt:number;outcome:Outcome|null}};
type Db=ReturnType<ForecastStore['db']>;
type Source={board:Board<IndividualSport>|null;results:History[];archive?:Awaited<ReturnType<ResultsFeed['archive']>>;score?: (m:Match)=>number|undefined};

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

export function agreementBlend(sports:number,prices:FrozenWinner['prices']) {
  if(!prices?.home||!prices.away)return;
  const market=fairMarketProbability(prices.home.odds,prices.away.odds);
  if(market===null)return;
  const disagree=sports!==.5&&market!==.5&&(sports>.5)!==(market>.5);
  if(disagree)return market;
  const logit=(p:number)=>Math.log(p/(1-p));
  return 1/(1+Math.exp(-(.75*logit(market)+.25*logit(sports))));
}

export function freezeWinner(m:Match, now:number, p:number, model:string, quotes:FeedQuote[]):FrozenWinner|undefined {
  const starts=Date.parse(m.kickoff_utc??'');
  if(m.in_play||!Number.isFinite(starts)||starts-now<=lead||starts-now>26*hour||
      !Number.isFinite(p)||p<=0||p>=1||normalized(m.home)===normalized(m.away))return;
  const prices=pairedPrices(m,quotes,now);
  const closingComparable=m.sport==='table_tennis'&&prices?.home&&prices.away&&quotes.every(q=>q.market_id==='920000'&&!q.period);
  const agreement=m.sport==='table_tennis'?agreementBlend(p,prices):undefined;
  return {sport:m.sport,id:m.id,home:m.home,away:m.away,league:m.league,seenAt:now,scheduledAt:starts,
    model,homeProbability:p,selection:p===.5?null:p>.5?'home':'away',prices,...(closingComparable?{closingComparable:true as const}:{}),
    ...(agreement!==undefined?{agreementBlendHomeProbability:agreement}:{})};
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

export function marketBlend25(f:Pick<FrozenWinner,'prices'|'homeProbability'|'peerHomeProbability'>) {
  if(f.peerHomeProbability===undefined||!f.prices?.home||!f.prices.away)return;
  const market=fairMarketProbability(f.prices.home.odds,f.prices.away.odds);
  if(market===null)return;
  const sports=(f.homeProbability+f.peerHomeProbability)/2;
  const logit=(p:number)=>Math.log(p/(1-p));
  return 1/(1+Math.exp(-(.75*logit(market)+.25*logit(sports))));
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
    ...(result.sets?.length?{sets:order?result.sets:result.sets.map(([home,away]):[number,number]=>[away,home])}:{}),
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

function bestArchivedValue(f:FrozenWinner,minimumOdds:number,peerRequired=false) {
  // A coherent two-way book admits a single high-EV side in ordinary cases.
  // Rank eligible sides explicitly and make equal estimates deterministic.
  if(peerRequired&&f.peerHomeProbability===undefined)return;
  return (['home','away'] as const).flatMap(side=>{
    const price=f.prices?.[side];
    if(!price||!Number.isFinite(price.odds)||price.odds<minimumOdds)return [];
    const probability=side==='home'?f.homeProbability:1-f.homeProbability;
    const peer=f.peerHomeProbability===undefined?probability:side==='home'?f.peerHomeProbability:1-f.peerHomeProbability;
    return [{side,odds:price.odds,ev:(peerRequired?Math.min(probability,peer):probability)*price.odds-1}];
  }).sort((a,b)=>b.ev-a.ev)[0];
}

export function blindAudit(rows:Row[]):BlindAudit {
  const cases=rows.filter(row=>row.parameters.forecast.sport==='table_tennis');
  const groups=new Map<string,Row[]>();
  let from=Infinity,to=-Infinity;
  const summarize=(observations:Row[],minimumOdds:number,minimumEv:number,peerRequired:boolean):BlindHighEv=>{
    let eligible=0,registered=0,favorites=0,favoritesExact=0,favoritesWrong=0,exact=0,wrong=0,pending=0,unverified=0,invalid=0,winsAtOdds=0;
    for(const {parameters:{forecast:f,outcome:o}} of observations){
      const selection=bestArchivedValue(f,minimumOdds,peerRequired);
      if(!selection)continue;
      eligible++;
      if(selection.ev<=minimumEv+1e-12)continue;
      registered++;
      const favorite=selection.side===f.selection;
      if(favorite)favorites++;
      if(!o)pending++;
      else if(o.invalid)invalid++;
      else if(o.actualGuard===null)unverified++;
      else if(selection.side===o.winner){exact++;winsAtOdds+=selection.odds;if(favorite)favoritesExact++;}
      else{wrong++;if(favorite)favoritesWrong++;}
    }
    return {eligible,registered,favorites,favoritesExact,favoritesWrong,exact,wrong,pending,unverified,invalid,
      roi:exact+wrong?winsAtOdds/(exact+wrong)-1:null};
  };
  for(const row of cases){
    const {forecast:f}=row.parameters;
    const group=groups.get(f.model)??[];
    group.push(row);groups.set(f.model,group);
    from=Math.min(from,f.seenAt);to=Math.max(to,f.seenAt);
  }
  const summarizeBands=(group:Row[],peerRequired=false)=>Object.fromEntries(blindEvBands.map(({key,minimumOdds,minimumEv})=>
    [key,summarize(group,minimumOdds,minimumEv,peerRequired)])) as BlindEvBands;
  const bands=summarizeBands(cases);
  return {...blindSummary(cases,'table_tennis'),from:Number.isFinite(from)?new Date(from).toISOString():null,
    until:Number.isFinite(to)?new Date(to).toISOString():null,
    calibration:oddsCalibration(cases.flatMap(({parameters:{forecast:f,outcome:o}})=>{
      if(!o||o.invalid||o.actualGuard===null||!f.prices?.home||!f.prices.away)return [];
      return [{homeOdds:f.prices.home.odds,awayOdds:f.prices.away.odds,homeProbability:f.homeProbability,
        candidate:f.agreementBlendHomeProbability,homeWon:o.winner==='home'}];
    })),
    highEv:bands.above50,bands,peerConfirmed:summarizeBands(cases,true),
    peerBaseline:summarizeBands(cases.filter(row=>row.parameters.forecast.peerHomeProbability!==undefined)),models:[...groups].map(([model,group])=>{
      const byBand=summarizeBands(group);
      return {model,n:group.length,highEv:byBand.above50,bands:byBand};
    })};
}

export function blindArchiveCsv(rows:Row[]) {
  const header=['event_id','competition','home','away','model','forecast_utc','kickoff_utc','result_utc','result_state','winner','sets','model_favorite',
    'home_model_p','away_model_p','home_fair_odds','away_fair_odds','home_bet365_au','away_bet365_au','home_quote_utc','away_quote_utc',
    'home_ev','away_ev','ev_above_50_selection','ev_above_50_outcome','verified_start_guard_utc','home_market_no_vig_p','home_elo_p','home_blend25_p','home_elo_external_calibrated_v42_p','home_agreement_blend_v43_p','ev_above_60_selection','ev_above_60_outcome','odds_ge_2_ev_above_50_selection','odds_ge_2_ev_above_50_outcome'];
  const cell=(value:string|number|null|undefined)=>{
    if(typeof value==='number')return String(value);
    const clean=value??'';
    return '"'+(/^[\s]*[=+@-]/.test(clean)?"'":'')+clean.replaceAll('"','""')+'"';
  };
  const records=rows.filter(r=>r.parameters.forecast.sport==='table_tennis').map(({parameters:{forecast:f,outcome:o}})=>{
    const home=f.prices?.home,away=f.prices?.away;
    const status=!o?'pending':o.invalid?'invalid':o.actualGuard===null?'reported':'verified';
    const byBand=blindEvBands.map(({minimumOdds,minimumEv})=>{
      const selection=bestArchivedValue(f,minimumOdds);
      const side=selection&&selection.ev>minimumEv+1e-12?selection.side:null;
      return [side,side&&status==='verified'&&o?(side===o.winner?'exact':'wrong'):null];
    });
    return [f.id,f.league,f.home,f.away,f.model,new Date(f.seenAt).toISOString(),new Date(f.scheduledAt).toISOString(),o?.finishedAt,status,
      o?.winner,o?.sets?.map(([a,b])=>a+'-'+b).join(' | '),f.selection,
      f.homeProbability,1-f.homeProbability,1/f.homeProbability,1/(1-f.homeProbability),home?.odds,away?.odds,home?.quoteAt,away?.quoteAt,
      home?f.homeProbability*home.odds-1:null,away?(1-f.homeProbability)*away.odds-1:null,...byBand[0],
      o?.actualGuard!=null?new Date(o.actualGuard).toISOString():null,
      home&&away?fairMarketProbability(home.odds,away.odds):null,f.peerHomeProbability,f.marketBlend25HomeProbability,f.externalEloCalibratedHomeProbability,f.agreementBlendHomeProbability,...byBand[1],...byBand[2]].map(cell).join(',');
  });
  return [header.join(','),...records].join('\r\n')+'\r\n';
}

function agreementBenchmark(rows:Row[]) {
  let count=0,candidate=0,marketScore=0,sports=0,disagreements=0;
  for(const {parameters:{forecast:f,outcome:o}} of rows){
    if(!o||o.invalid||o.actualGuard===null||f.agreementBlendHomeProbability===undefined||!f.prices?.home||!f.prices.away)continue;
    const market=fairMarketProbability(f.prices.home.odds,f.prices.away.odds);
    if(market===null)continue;
    const result=Number(o.winner==='home');
    count++;
    if(f.homeProbability!==.5&&market!==.5&&(f.homeProbability>.5)!==(market>.5))disagreements++;
    candidate+=(f.agreementBlendHomeProbability-result)**2;
    marketScore+=(market-result)**2;
    sports+=(f.homeProbability-result)**2;
  }
  return count?{count,disagreements,brier:candidate/count,marketBrier:marketScore/count,sportsBrier:sports/count}:null;
}

function weeklyRows(rows:Row[]) {
  return rows.filter(({parameters:{forecast:f}})=>f.sport==='table_tennis'&&f.seenAt>=weeklyStart&&f.seenAt<weeklyEnd&&f.scheduledAt<weeklyEnd);
}

export function weeklyClosingOrder<T extends {parameters:{forecast:Pick<FrozenWinner,'seenAt'|'prices'>}}>(oldestFirst:T[]) {
  const newer:T[]=[],other:T[]=[];
  for(const row of oldestFirst){
    const {seenAt,prices}=row.parameters.forecast;
    (seenAt>=disagreementStartAt&&prices?.home&&prices?.away?newer:other).push(row);
  }
  const order:T[]=[];
  for(let i=0;i<Math.max(newer.length,other.length);i++){
    if(newer[i])order.push(newer[i]);
    if(other[i])order.push(other[i]);
  }
  return order;
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
    theoreticalRoi:value?units/value-1:null,closingPairs,betterThanClosing,agreement:agreementBenchmark(rows)};
}

function weeklyDisagreement(rows:Row[]) {
  return disagreementReport(rows.flatMap(({parameters:{forecast:f,outcome:o}})=>{
    if(!o||o.invalid||o.actualGuard===null||!f.prices?.home||!f.prices.away)return [];
    return [{at:f.seenAt,homeOdds:f.prices.home.odds,awayOdds:f.prices.away.odds,
      homeProbability:f.homeProbability,peerHomeProbability:f.peerHomeProbability,homeWon:o.winner==='home'}];
  }));
}

function utcWeek(at:number) {
  const date=new Date(at);
  date.setUTCHours(0,0,0,0);
  return date.getTime()-((date.getUTCDay()+6)%7)*24*hour;
}

export function blindHistory(rows:Row[],now:number,last=utcWeek(now)):BlindHistory {
  const first=last+week-historyWindow;
  const groups=new Map<number,Row[]>();
  const results:BlindHistory['recent']=[];
  for(const row of rows){
    const {forecast:f,outcome:o}=row.parameters;
    if(f.sport!=='table_tennis'||f.seenAt<first||f.seenAt>=last+week||f.seenAt>now)continue;
    const start=utcWeek(f.seenAt);
    const group=groups.get(start)??[];
    group.push(row);
    groups.set(start,group);
    if(!o||o.invalid)continue;
    results.push({id:f.id,home:f.home,away:f.away,league:f.league,model:f.model,seenAt:f.seenAt,
      homeProbability:f.homeProbability,peerHomeProbability:f.peerHomeProbability,
      marketBlend25HomeProbability:f.marketBlend25HomeProbability,
      homeOdds:f.prices?.home?.odds??null,awayOdds:f.prices?.away?.odds??null,
      winner:o.winner,finishedAt:o.finishedAt,sets:o.sets,status:o.actualGuard===null?'reported':'verified',
      prediction:f.selection===null?null:f.selection===o.winner?'exact':'wrong'});
  }
  const weeks:BlindHistoryWeek[]=[];
  for(let start=last;start>=Math.max(first,historyStart);start-=week){
    const group=groups.get(start)??[];
    let count=0,modelBrier=0,eloBrier=0,marketBrier=0;
    let candidateCount=0,candidateBrier=0,candidateMarketBrier=0;
    let externalCount=0,externalBrier=0,externalEloBrier=0,externalMarketBrier=0;
    for(const {parameters:{forecast:f,outcome:o}} of group){
      if(!o||o.invalid||o.actualGuard===null||f.peerHomeProbability===undefined||!f.prices?.home||!f.prices.away)continue;
      const market=fairMarketProbability(f.prices.home.odds,f.prices.away.odds);
      if(market===null)continue;
      const y=Number(o.winner==='home');
      count++;
      modelBrier+=(f.homeProbability-y)**2;
      eloBrier+=(f.peerHomeProbability-y)**2;
      marketBrier+=(market-y)**2;
      if(f.externalEloCalibratedHomeProbability!==undefined){
        externalCount++;
        externalBrier+=(f.externalEloCalibratedHomeProbability-y)**2;
        externalEloBrier+=(f.peerHomeProbability-y)**2;
        externalMarketBrier+=(market-y)**2;
      }
      if(f.marketBlend25HomeProbability!==undefined){
        candidateCount++;
        candidateBrier+=(f.marketBlend25HomeProbability-y)**2;
        candidateMarketBrier+=(market-y)**2;
      }
    }
    weeks.push({from:new Date(start).toISOString(),until:new Date(start+week).toISOString(),
      ...blindSummary(group,'table_tennis'),
      peer:count?{count,modelBrier:modelBrier/count,eloBrier:eloBrier/count,marketBrier:marketBrier/count}:null,
      candidate:candidateCount?{count:candidateCount,brier:candidateBrier/candidateCount,marketBrier:candidateMarketBrier/candidateCount}:null,
      external:externalCount?{count:externalCount,brier:externalBrier/externalCount,
        eloBrier:externalEloBrier/externalCount,marketBrier:externalMarketBrier/externalCount}:null,
      agreement:agreementBenchmark(group),disagreements:weeklyDisagreement(group).forward});
  }
  const latest=utcWeek(now);
  return {startsAt:new Date(weeklyEnd).toISOString(),weeks,
    older:first>historyStart?new Date(first-week).toISOString():null,
    newer:last<latest?new Date(Math.min(latest,last+historyWindow)).toISOString():null,
    recent:results.sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt)||a.id.localeCompare(b.id)).slice(0,20)};
}

export function logWeeklyDisagreement(report:ReturnType<typeof disagreementReport>){
  for(const cohort of ['earlier','forward'] as const){
    console.info(JSON.stringify({weeklyDisagreement:cohort,startsAt:report.startsAt,bands:report[cohort]}));
  }
}

export class BlindStudy {
  private store:ForecastStore;
  private owner:ProspectiveStudy;
  private running?:Promise<unknown>;
  constructor(private env:Env,private now=Date.now,private feed:Pick<MoviOddsFeed,'board'>=new MoviOddsFeed(fetch,now,env),
    private results=new ResultsFeed(fetch,now,env),private additional=new IndividualSports(env,now),private fetcher=fetch,
    private weeklyFeed:Pick<MoviOddsFeed,'board'>=new MoviOddsFeed<'table_tennis'>(fetcher,now,env,undefined,tableTennisWinnerGroup),
    private historyFeed:Pick<MoviOddsFeed,'board'>=new MoviOddsFeed(fetcher,now,env,'table_tennis')){
    this.store=new ForecastStore(env,now);
    this.owner=new ProspectiveStudy(env,now);
  }
  private async rows(db:Db,owner:string,from?:string,before?:string){
    const rows:Row[]=[];
    for(let page=0;;page++){
      let request=db.from('model_versions').select('id,created_at,parameters').eq('name',rowName)
        .contains('parameters',{study,userId:owner}).order('created_at',{ascending:false}).order('id',{ascending:false})
        .range(page*1000,page*1000+999);
      if(from)request=request.gte('created_at',from);
      if(before)request=request.lt('created_at',before);
      const reply=await request;
      if(reply.error||!reply.data)throw Error('BLIND_STUDY_READ_FAILED');
      rows.push(...(reply.data as unknown as Row[]).filter(eligible));
      if(reply.data.length<1000)break;
    }
    return rows;
  }
  async report(userId:string,historyWeek?:string|null):Promise<BlindStudyReport>{
    const owner=await this.owner.ownerId();
    const enabled=blindStudyEnabled(this.env);
    const now=this.now(),db=this.store.db(),requested=Date.parse(historyWeek??'');
    const last=Number.isFinite(requested)?Math.max(historyStart,Math.min(utcWeek(requested),utcWeek(now))):utcWeek(now);
    const until=last+week,first=until-historyWindow;
    const containsPilot=first<=weeklyStart&&until>=weeklyEnd+hour;
    const [rows,pilot,pricing]=await Promise.all([
      this.rows(db,owner,new Date(first).toISOString(),new Date(until+hour).toISOString()),
      containsPilot?[]:this.rows(db,owner,new Date(weeklyStart).toISOString(),new Date(weeklyEnd+hour).toISOString()),
      last===utcWeek(now)?pricingCoverage(db,owner).catch(()=>null):undefined,
    ]);
    const collected=weeklyRows(containsPilot?rows:pilot);
    return {enabled,canRun:userId===owner,scheduled:enabled&&this.env.VERCEL_ENV==='production'&&!!this.env.CRON_SECRET,
      checkedAt:new Date(now).toISOString(),sports:sports.map(sport=>blindSummary(rows.filter(r=>r.parameters.forecast.seenAt<until),sport)),
      weekly:weeklySummary(collected),weeklyDisagreement:weeklyDisagreement(collected),pricing:pricing?pricingReport(pricing,new Map(rows.flatMap(({parameters:{forecast,outcome}})=>
        forecast.sport==='table_tennis'&&outcome?[[forecast.id,{...outcome,home:forecast.home,away:forecast.away,league:forecast.league}]]:[])),now):pricing,history:blindHistory(rows,now,last)};
  }
  async audit():Promise<BlindAudit>{
    return blindAudit(await this.rows(this.store.db(),await this.owner.ownerId()));
  }
  async archiveCsv():Promise<string>{
    return blindArchiveCsv(await this.rows(this.store.db(),await this.owner.ownerId()));
  }
  async disagreementSnapshot(){
    const owner=await this.owner.ownerId();
    return weeklyDisagreement(weeklyRows(await this.rows(this.store.db(),owner,new Date(weeklyStart-60_000).toISOString())));
  }
  async run(userId?:string,deadline=this.now()+170_000,bootstrap=false){
    if(!blindStudyEnabled(this.env))return {status:'disabled'};
    const owner=await this.owner.ownerId();
    if(userId&&userId!==owner)throw Error('BLIND_STUDY_OWNER_ONLY');
    if(this.running)return this.running;
    this.running=this.execute(owner,deadline,bootstrap);
    try{return await this.running;}finally{this.running=undefined;}
  }
  async runWeekly(recovery=false){
    if(this.env.VERCEL_ENV!=='production'||!blindStudyEnabled(this.env))return {status:'disabled'};
    if(this.now()<weeklyStart||this.now()>=weeklyFollowup)return {status:'window_closed'};
    const owner=await this.owner.ownerId();
    const started=this.now(),db=this.store.db();
    const heartbeat=studyUuid(`${study}:${owner}:weekly-heartbeat`);
    if(recovery){
      const previous=await db.from('model_versions').select('parameters').eq('id',heartbeat).maybeSingle();
      if(previous.error)throw Error('WEEKLY_STUDY_HEARTBEAT_READ_FAILED');
      const last=Number(previous.data?.parameters?.completedAt);
      if(!weeklyScanOverdue(last,started))return {status:'healthy'};
      console.warn(JSON.stringify({weeklyStudyWatchdog:'retry',lastSuccessAt:last>0?new Date(last).toISOString():null,
        incident:last>0?String(last):'first-heartbeat',checkedAt:new Date(started).toISOString()}));
    }
    const result=await this.execute(owner,started+120_000,false,'weekly',recovery,heartbeat);
    if(recovery&&result.status==='completed')console.info(JSON.stringify({weeklyStudyWatchdog:'restored',checkedAt:new Date(this.now()).toISOString()}));
    return result;
  }
  async runHistory(){
    if(this.env.VERCEL_ENV!=='production'||!blindStudyEnabled(this.env))return {status:'disabled'};
    if(this.now()<weeklyEnd)return {status:'window_closed'};
    const owner=await this.owner.ownerId();
    return this.execute(owner,this.now()+120_000,false,'history');
  }
  private async source(sport:IndividualSport,mode:CollectionMode):Promise<Source>{
    const weekly=mode!=='daily';
    if(sport==='table_tennis'){
      const [board,results]=await Promise.allSettled([(mode==='weekly'?this.weeklyFeed:mode==='history'?this.historyFeed:this.feed).board(),this.results.archive()]);
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
      if(weekly&&board.status==='fulfilled'&&(board.value.warming||this.now()-Date.parse(board.value.checkedAt)>30_000)){
        console.warn(JSON.stringify({weeklyStudyFeed:'board',code:'BLIND_BOARD_NOT_CURRENT'}));
        return {board:null,results:archive.results};
      }
      return {board:board.status==='fulfilled'?board.value:null,results:archive.results,archive,
        score:m=>scoreWinnerEstimate(m as FeedMatch,archive,this.now())?.homeProbability};
    }
    const [board,raw]=await Promise.all([this.additional.activeBoard(sport),readSportResults(sport,this.env,this.fetcher)]);
    const archive=sportResults(sport,raw,this.now());
    if(archive.source!=='postgres')throw Error('BLIND_ARCHIVE_INCOMPLETE');
    return {board,results:archive.rows.map(r=>({id:r.id,home:r.home,away:r.away,league:r.league,
      finishedAt:new Date(r.finished).toISOString(),availableAt:new Date(r.available).toISOString(),homeWon:r.won===1}))};
  }
  private async execute(owner:string,deadline:number,bootstrap:boolean,mode:CollectionMode='daily',recovery=false,heartbeat?:string){
    const db=this.store.db(), started=this.now(), isoStart=new Date(started).toISOString();
    const day=isoStart.slice(0,10), bucket=mode==='history'?120:recovery?15:mode==='weekly'?30:10;
    const prefix=recovery?'weekly-recovery:':mode==='daily'?'':`${mode}:`;
    const slot=bootstrap?'bootstrap':`${prefix}${Math.floor(started/(bucket*minute))}`;
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
    try {
      const result=await this.collect(db,owner,deadline,started,day,mode);
      if(heartbeat&&result.status==='completed'){
        const completedAt=this.now();
        const saved=await db.from('model_versions').upsert({id:heartbeat,name:'Blind weekly heartbeat v1',
          version:`${study}:weekly-heartbeat:${owner}`,training_cutoff:isoStart,validated:false,parameters:{completedAt}},{onConflict:'id'});
        if(saved.error)throw Error('WEEKLY_STUDY_HEARTBEAT_WRITE_FAILED');
      }
      return result;
    }
    finally {
      const released=await db.from('model_versions').update({parameters:{until:0}}).eq('id',leaseId).eq('parameters->>token',token);
      if(released.error)console.warn('BLIND_STUDY_LEASE_RELEASE_FAILED');
    }
  }
  private async collect(db:Db,owner:string,deadline:number,started:number,day:string,mode:CollectionMode){
    const weekly=mode==='weekly', tableOnly=mode!=='daily';
    const prior=await this.rows(db,owner,new Date(started-archiveGrace).toISOString());
    const bySport=new Map<IndividualSport,Source>();
    const feeds=tableOnly?(['table_tennis'] as const):sports;
    await Promise.all(feeds.map(async sport=>{
      try{bySport.set(sport,await this.source(sport,mode));}catch(error){console.warn(JSON.stringify({blindStudySource:'unavailable',sport,code:sourceFailure(error)}));}
    }));
    const seen=new Set(prior.map(r=>JSON.stringify([r.parameters.forecast.sport,r.parameters.forecast.id])));
    if(tableOnly&&!bySport.has('table_tennis'))throw Error('BLIND_STUDY_SOURCE_UNAVAILABLE');
    const left=tableOnly ? (weekly&&started>=weeklyEnd?0:Infinity)
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
        if(f&&sport==='table_tennis'&&at>=disagreementStartAt&&ready!==undefined&&local!==undefined){
          f.peerHomeProbability=local;
          f.externalEloCalibratedHomeProbability=1/(1+Math.exp(-externalEloSlope*Math.log(local/(1-local))));
          const blend=marketBlend25(f);
          if(blend!==undefined)f.marketBlend25HomeProbability=blend;
        }
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
    let pricingCaptured=0;
    const pricing=bySport.get('table_tennis'),board=pricing?.board as Board|undefined,pricingAt=this.now();
    if(board&&pricing?.archive&&pricingAt<deadline-30_000){
      try{
        const matches=board.matches.filter(m=>isSetka(m.league)&&!m.in_play&&
          Date.parse(m.kickoff_utc??'')-pricingAt>=lead&&Date.parse(m.kickoff_utc??'')-pricingAt<=2*hour)
          .sort((a,b)=>a.kickoff_utc!.localeCompare(b.kickoff_utc!)||a.id.localeCompare(b.id)).slice(0,40);
        const candidatesById=new Map(candidates.filter(f=>f.sport==='table_tennis').map(f=>[f.id,f]));
        const snapshots=matches.flatMap(match=>{
          const values:Partial<Record<PricingSnapshot['markets'][number]['target'],number>>={};
          const winner=candidatesById.get(match.id);
          const score=winner?.homeProbability??pricing.score?.(match);
          if(score!==undefined)values.winner=score;
          const report=marketEstimateReport(match,pricing.archive!,pricingAt,confirmedBestOfFive(match,pricingAt));
          for(const quote of match.quotes){
            const p=report.estimates[marketPriceKey(quote)],target=marketTarget(match,quote);
            if(p!==undefined&&target&&!target.invert)values[target.target]=p;
          }
          const snapshot=pricingSnapshot(board,match,pricingAt,values);
          return snapshot?[snapshot]:[];
        });
        pricingCaptured=await savePricingSnapshots(db,owner,snapshots);
      }catch{console.warn('PRICING_CAPTURE_FAILED');}
    }
    const resultMaps=new Map([...bySport].map(([sport,data])=>[sport,new Map(data.results.map(result=>[result.id,result]))]));
    let calls=0, next=0, closingAvailable=true;
    const oldestFirst=(weekly?weeklyRows(prior):tableOnly?prior.filter(r=>r.parameters.forecast.sport==='table_tennis'):prior).reverse();
    // Reserve half of the existing closing-check budget for the newer priced cohort.
    // Partition the eligible requests before interleaving so pending fixtures cannot skew it.
    const closingEligible=(row:Row)=>{
      const {parameters:p}=row;
      return !p.outcome?.invalid&&p.outcome?.actualGuard==null&&p.attempts<2
        &&started-p.lastAttempt>12*hour&&resultMaps.get(p.forecast.sport)?.has(p.forecast.id);
    };
    const rows=tableOnly?[
      ...weeklyClosingOrder(oldestFirst.filter(closingEligible)),
      ...oldestFirst.filter(row=>!closingEligible(row)),
    ]:oldestFirst;
    for(const row of rows){
      if(this.now()>=deadline-7_000)break;
      const {parameters:p}=row,f=p.forecast,r=resultMaps.get(f.sport)?.get(f.id);
      if(!r||p.outcome?.actualGuard!=null||p.outcome?.invalid)continue;
      const outcome=settleObserved(f,r,Date.parse(row.created_at),this.now());
      if(!outcome)continue;
      let attempts=p.attempts, lastAttempt=p.lastAttempt;
      if(!outcome.invalid&&closingAvailable&&calls<(mode==='history'?2:weekly?4:16)&&attempts<2&&this.now()-lastAttempt>12*hour&&this.now()<deadline-10_000){
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
              if(f.sport==='table_tennis'&&isSetka(f.league)&&!outcome.invalid){
                const priceMatch={id:f.id,sport:'table_tennis' as const,home:f.home,away:f.away,league:f.league,in_play:false,quotes:[]};
                const marketCloses=archivedPricingPairs(payload,priceMatch,at);
                if(marketCloses.length)outcome.pricingClosing=marketCloses;
              }
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
    const summary={status:tableOnly&&!bySport.get('table_tennis')?.board?'settlement_only':'completed',captured,reported,verified,pricingCaptured,capturedBySport,capturedWithPrice,feeds:bySport.size,closingQueries:calls,checkedAt:new Date(started).toISOString()};
    if(weekly){
      const all=weeklyRows(await this.rows(db,owner,new Date(weeklyStart-60_000).toISOString(),new Date(weeklyEnd+hour).toISOString()));
      console.info(JSON.stringify({weeklyPingPongRun:summary,weekly:weeklySummary(all),evBands:blindAudit(all).bands}));
      logWeeklyDisagreement(weeklyDisagreement(all));
    }else if(tableOnly)console.info(JSON.stringify({longitudinalPingPongRun:summary}));
    else console.info(JSON.stringify({blindStudyRun:summary}));
    return summary;
  }
}
