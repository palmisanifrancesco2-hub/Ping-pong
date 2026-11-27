import {marketIdentity, type Board, type FeedMatch, type FeedQuote} from '../src/shared/board.js';
import {freshMatchQuote,hasBestOfFiveMarket} from '../src/shared/additional-markets.js';
import {bookmakerWinnerPrices} from '../src/shared/quote-selection.js';
import {modelMetrics} from '../src/domain/player-model.js';
import {marketInterval} from '../src/domain/market-validation.js';
import {marketTarget} from './market-estimates.js';
import {marketHash, studyUuid} from './research-integrity.js';
import type {ForecastStore} from './forecast-store.js';

type Db=ReturnType<ForecastStore['db']>;
type Price={side:string;line:string;odds:number;quotedAt:string};
type Pair={target:string;key:string;readAt:string;prices:[Price,Price]};
export type PricingSnapshot={
  id:string;home:string;away:string;league:string;observedAt:string;decisionAt:string;kickoff:string;
  provider:'MoviOdds';site:'bet365.com.au';availability:'feed_observed';
  markets:(Pair&{proportional:number;power:number;margin:number;model:number|null})[];
};

const rowName='Setka pricing snapshot v1';
const interval=120_000;
const paperRowName='Setka paper pricing decision v1';
export const paperProtocol={minimumOdds:1.30, probabilityStress:.05, netPriceStress:.05, delaySeconds:60, latestDelaySeconds:180};
export const isSetka=(league:string)=>league==='Setka Cup'||league==='Setka Cup Women';

export function removeMargin(odds:[number,number]){
  if(odds.some(q=>!Number.isFinite(q)||q<=1))return null;
  const [a,b]=odds.map(q=>1/q),sum=a+b;
  if(sum<1-1e-12)return null;
  let lo=1,hi=2;
  while(a**hi+b**hi>1)hi*=2;
  for(let i=0;i<48;i++){
    const mid=(lo+hi)/2;
    if(a**mid+b**mid>1)lo=mid;else hi=mid;
  }
  return {proportional:a/sum,power:a**((lo+hi)/2),margin:sum-1};
}

export function expectedReturn(odds:number, probabilities:[number,number,number,number,number]){
  if(!Number.isFinite(odds)||odds<=1||probabilities.some(p=>!Number.isFinite(p)||p<0||p>1)||
    Math.abs(probabilities.reduce((sum,p)=>sum+p,0)-1)>1e-9)return null;
  const [win,halfWin,push,halfLoss]=probabilities;
  return win*odds+halfWin*(odds+1)/2+push+halfLoss/2-1;
}

type Selection={quote:FeedQuote;invert:boolean};
function completePairs(match:FeedMatch, groups:Map<string,{target:string;selections:Selection[]}>,read:(q:FeedQuote)=>string|undefined){
  const pairs:Pair[]=[];
  for(const [key,{target,selections}] of groups){
    if(selections.length!==2||selections[0].invert===selections[1].invert)continue;
    const [a,b]=[...selections].sort((a,b)=>Number(a.invert)-Number(b.invert)).map(s=>s.quote);
    const readAt=read(a);
    if(!readAt||readAt!==read(b)||a.sel_id===b.sel_id||a.side===b.side)continue;
    const price=(q:FeedQuote):Price=>({side:q.side!,line:((q.handicap??q.line)||'To Win'),odds:q.odds_dec,quotedAt:q.ts});
    if(a.fixture_id!==match.id||b.fixture_id!==match.id)continue;
    pairs.push({target,key,readAt,prices:[price(a),price(b)]});
  }
  return pairs.sort((a,b)=>a.key.localeCompare(b.key));
}

function observedTarget(match:FeedMatch,q:FeedQuote){
  if(q.handicap&&q.line&&q.line!=='Total'&&q.line!=='Line'&&Number(q.handicap)!==Number(q.line))return;
  const target=marketTarget(match,q);
  if(target)return target;
  const key=q.group_id+':'+q.market_id,period=q.period??'';
  const side=q.side,player=side===match.home||side===match.away;
  if(!period&&['240:920065','920000:920008'].includes(key))return;
  if(/^[1-7]$/.test(period)&&['238:920055','920096:920096'].includes(key)&&player&&!q.handicap&&(!q.line||q.line==='To Win')){
    return {target:'set-'+period+'-winner',invert:side===match.away};
  }
  const raw=q.handicap??q.line??'';
  if(!/^[+-]?\d+\.5$/.test(raw))return;
  const amount=Number(raw);
  if(amount>0&&(side==='Over'||side==='Under')){
    const prefix=!period&&['240:920066','920000:920014'].includes(key)?'points-over-'
      :/^[1-7]$/.test(period)&&['238:920056','920096:920111'].includes(key)?'set-'+period+'-points-over-':'';
    if(prefix)return {target:prefix+amount,invert:side==='Under'};
  }
  if(player){
    const prefix=!period&&['240:920134','920009:920009'].includes(key)?'home-point-handicap-'
      :/^[1-7]$/.test(period)&&['238:920081','920096:920103','238:920055'].includes(key)?'home-set-'+period+'-point-handicap-':'';
    const line=side===match.away?-amount:amount;
    if(prefix)return {target:prefix+(line<0?'minus-':'plus-')+Math.abs(line),invert:side===match.away};
  }
}

export function confirmedBestOfFive(match:FeedMatch,now:number){
  if(hasBestOfFiveMarket(match,now))return true;
  const scores=match.quotes.filter(q=>q.group_id==='920129'&&q.market_id==='920129'&&q.group_name==='Game Betting'&&
    !q.period&&freshMatchQuote(match,q,now));
  const expected=[match.home,match.away].flatMap(side=>['3-0','3-1','3-2'].map(line=>JSON.stringify([side,line])));
  const offered=new Set(scores.map(q=>JSON.stringify([q.side,q.line])));
  return scores.length===6&&expected.every(key=>offered.has(key));
}

function grouped(match:FeedMatch,quotes:FeedQuote[],winner:FeedQuote[],bo5:boolean){
  const groups=new Map<string,{target:string;selections:Selection[]}>();
  for(const quote of quotes){
    if(!quote.market_id||!quote.side)continue;
    const pick=winner.includes(quote)
      ?{target:'winner' as const,invert:quote.side===match.away}
      :bo5?observedTarget(match,quote):undefined;
    if(!pick)continue;
    const key=JSON.stringify([marketIdentity(quote),pick.target]);
    const entry=groups.get(key)??{target:pick.target,selections:[]};
    entry.selections.push({quote,invert:pick.invert});
    groups.set(key,entry);
  }
  return groups;
}

export function pricingSnapshot(board:Board,match:FeedMatch,now:number,probabilities?:Partial<Record<string,number>>):PricingSnapshot|null {
  const observed=Date.parse(board.checkedAt),kickoff=Date.parse(match.kickoff_utc??'');
  if(board.warming||board.bookmakerSite!=='bet365.com.au'||!isSetka(match.league)||match.in_play||
    !(kickoff>now)||!(observed<=now&&now-observed<=30_000))return null;
  const eligible=(q:FeedQuote)=>{
    const group=match.group_status?.[q.group_id],update=Date.parse(group?.polled_at??''),stamp=Date.parse(q.ts);
    return q.suspended===false&&q.phase==='prematch'&&Number.isFinite(q.odds_dec)&&q.odds_dec>1&&!group?.stale
      && stamp<=observed&&observed-stamp<=interval&&update<=observed&&observed-update<=interval;
  };
  const winners=bookmakerWinnerPrices(match,now).filter(q=>q.market_id==='920000'&&!q.period);
  const groups=grouped(match,match.quotes,winners,confirmedBestOfFive(match,now));
  const markets=completePairs(match,groups,q=>eligible(q)?match.group_status![q.group_id].polled_at:undefined).flatMap(pair=>{
    const fair=removeMargin([pair.prices[0].odds,pair.prices[1].odds]);
    if(!fair)return [];
    const p=probabilities?.[pair.target];
    return [{...pair,...fair,model:p!==undefined&&p>0&&p<1?p:null}];
  });
  return markets.length?{id:match.id,home:match.home,away:match.away,league:match.league,observedAt:board.checkedAt,decisionAt:new Date(now).toISOString(),
    kickoff:match.kickoff_utc!,provider:board.provider,site:board.bookmakerSite,availability:'feed_observed',markets}:null;
}

export function paperSides(snapshot:PricingSnapshot){
  const targetCounts=new Map<string,number>();
  for(const row of snapshot.markets)targetCounts.set(row.target,(targetCounts.get(row.target)??0)+1);
  return snapshot.markets.flatMap(market=>{
    if(market.model===null||targetCounts.get(market.target)!==1)return [];
    const difference=Math.abs(market.proportional-market.power);
    return market.prices.map((quote,i)=>{
      const first=i===0,model=first?market.model!:1-market.model!;
      const marketProbability=first?market.proportional:1-market.proportional;
      const power=first?market.power:1-market.power;
      const ev=model*quote.odds-1;
      const stressed=Math.max(0,model-paperProtocol.probabilityStress)*(1+(1-paperProtocol.netPriceStress)*(quote.odds-1))-1;
      const trial=quote.odds>=paperProtocol.minimumOdds&&stressed>0&&model-marketProbability>difference&&model>power;
      return {event:snapshot.home+' – '+snapshot.away,home:snapshot.home,away:snapshot.away,eventId:snapshot.id,league:snapshot.league,kickoff:snapshot.kickoff,
        source:snapshot.provider,site:snapshot.site,observedAt:snapshot.observedAt,decisionAt:snapshot.decisionAt,market:market.target,marketKey:market.key,
        ...quote,marketProbability,power,model,fair:1/model,ev,stressed,trial};
    });
  });
}
export type PricingSide=ReturnType<typeof paperSides>[number];

export async function savePricingSnapshots(db:Db,owner:string,snapshots:PricingSnapshot[]){
  if(!snapshots.length)return 0;
  const records=snapshots.flatMap(snapshot=>{
    const version=JSON.stringify([rowName,owner,snapshot.site,snapshot.id,snapshot.observedAt]);
    const original={id:studyUuid(version),name:rowName,version,training_cutoff:snapshot.observedAt,validated:false,
      parameters:{userId:owner,snapshot,hash:marketHash(snapshot)}};
    const paper=paperSides(snapshot).filter(row=>row.trial).map(row=>{
      const version=JSON.stringify([paperRowName,owner,row.site,row.eventId,row.market]);
      return {id:studyUuid(version),name:paperRowName,version,training_cutoff:snapshot.observedAt,validated:false,
        parameters:{userId:owner,paper:row,hash:marketHash(row)}};
    });
    return [original,...paper];
  });
  const result=await db.from('model_versions').upsert(records,{onConflict:'id',ignoreDuplicates:true}).select('name');
  if(result.error)throw Error('PRICING_SNAPSHOT_WRITE_FAILED');
  return result.data?.filter(row=>row.name===rowName).length??0;
}

type Settlement={home:string;away:string;league:string;actualGuard:number|null;invalid:boolean;sets?:[number,number][];pricingClosing?:Pair[]};

function paperResult(row:PricingSide,sets:[number,number][]){
  const home=sets.filter(([a,b])=>a>b).length;
  const away=sets.length-home;
  if(Math.max(home,away)!==3&&row.market!=='winner')return null;
  if(row.market==='winner')return row.side===(home>away?row.home:row.away);
  if(row.market==='first-set')return row.side===(sets[0][0]>sets[0][1]?row.home:row.away);
  const line=Number(row.line);
  if(!Number.isFinite(line))return null;
  const total=sets.reduce((sum,[a,b])=>sum+a+b,0),points=sets.reduce((sum,[a,b])=>sum+a-b,0);
  if(row.side==='Over'||row.side==='Under'){
    const value=row.market.startsWith('sets-over-')?sets.length:row.market==='first-set-points-over-19.5'?sets[0][0]+sets[0][1]:total;
    return row.side==='Over'?value>line:value<line;
  }
  const diff=row.market.startsWith('home-set-handicap-')?home-away:points;
  return (row.side===row.home?diff:-diff)+line>0;
}

export async function pricingCoverage(db:Db,owner:string){
  const read=(name:string,limit:number)=>db.from('model_versions').select('created_at,parameters').eq('name',name)
    .contains('parameters',{userId:owner}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit);
  const [result,ledger]=await Promise.all([read(rowName,150),read(paperRowName,250)]);
  if(result.error||!result.data||ledger.error||!ledger.data)throw Error('PRICING_SNAPSHOT_READ_FAILED');
  return {snapshots:result.data.flatMap(row=>{
    const {snapshot,hash}=row.parameters as {snapshot:PricingSnapshot;hash:string};
    return snapshot&&marketHash(snapshot)===hash?[snapshot]:[];
  }),ledger:ledger.data.flatMap(row=>{
    const {paper,hash}=row.parameters as {paper:PricingSide;hash:string};
    return paper&&marketHash(paper)===hash?[{paper,createdAt:Date.parse(row.created_at)}]:[];
  })};
}

export function pricingReport(data:Awaited<ReturnType<typeof pricingCoverage>>,outcomes:Map<string,Settlement>,now:number){
  const targets=new Map<string,{fixtures:Set<string>;snapshots:number;withModel:number}>();
  const latest=new Map<string,PricingSide>();
  const reads=new Map<string,PricingSnapshot[]>();
  for(const snapshot of data.snapshots){
    const previous=reads.get(snapshot.id)??[];
    previous.push(snapshot);reads.set(snapshot.id,previous);
    for(const pair of snapshot.markets){
      const entry=targets.get(pair.target)??{fixtures:new Set<string>(),snapshots:0,withModel:0};
      entry.fixtures.add(snapshot.id);
      entry.snapshots++;
      if(pair.model!==null)entry.withModel++;
      targets.set(pair.target,entry);
    }
    if(Date.parse(snapshot.kickoff)<=now)continue;
    for(const row of paperSides(snapshot)){
      const key=JSON.stringify([row.eventId,row.marketKey,row.side]);
      if(!latest.has(key))latest.set(key,row);
    }
  }
  const recent=[...latest.values()].filter(row=>row.ev>0).sort((a,b)=>b.observedAt.localeCompare(a.observedAt)||b.stressed-a.stressed).slice(0,30);
  const ledger=data.ledger.map(({paper,createdAt})=>{
    const outcome=outcomes.get(paper.eventId),guard=outcome?.actualGuard;
    const recorded=Math.max(createdAt,Date.parse(paper.decisionAt));
    const verified=!!outcome&&!outcome.invalid&&guard!=null&&recorded<guard&&
      outcome.home===paper.home&&outcome.away===paper.away&&outcome.league===paper.league;
    const won=verified&&outcome.sets?.length?paperResult(paper,outcome.sets):null;
    const close=verified?outcome.pricingClosing?.find(pair=>pair.key===paper.marketKey&&pair.prices.every(q=>Date.parse(q.quotedAt)>recorded)):undefined;
    const closingOdds=close?.prices.find(q=>q.side===paper.side&&q.line===paper.line)?.odds??null;
    const fairClose=close&&closingOdds!==null?removeMargin([close.prices[0].odds,close.prices[1].odds]):null;
    const closingValue=fairClose&&close?paper.odds*(close.prices[0].side===paper.side?fairClose.proportional:1-fairClose.proportional)-1:null;
    const delay=verified?reads.get(paper.eventId)?.filter(snapshot=>{
      const at=Date.parse(snapshot.observedAt);
      return at>=recorded+paperProtocol.delaySeconds*1000&&at<=recorded+paperProtocol.latestDelaySeconds*1000&&at<guard;
    }).sort((a,b)=>a.observedAt.localeCompare(b.observedAt))[0]:undefined;
    const delayedOdds=delay?.markets.find(pair=>pair.key===paper.marketKey)?.prices.find(q=>q.side===paper.side&&q.line===paper.line)?.odds??null;
    return {...paper,won,closingOdds,closingValue,delayedOdds};
  });
  const grouped=new Map<string,typeof ledger>();
  for(const row of [...ledger].reverse()){
    const market=grouped.get(row.market)??[];
    market.push(row);
    grouped.set(row.market,market);
  }
  const summary=[...grouped].map(([market,all])=>{
    const settled=all.filter(row=>row.won!==null);
    const profit=settled.map(row=>row.won?row.odds-1:-1);
    const delayed=settled.filter(row=>row.delayedOdds!==null);
    const close=settled.flatMap(row=>row.closingValue===null?[]:[row.closingValue]);
    let balance=0,peak=0,drawdown=0;
    for(const pnl of profit){balance+=pnl;peak=Math.max(peak,balance);drawdown=Math.max(drawdown,peak-balance);}
    const interval=marketInterval(settled.map((row,i)=>({at:Date.parse(row.kickoff),value:profit[i]})),1000,Math.max(14,grouped.size));
    const probabilities=modelMetrics(settled.map(row=>({p:row.model,y:Number(row.won)})));
    return {market,records:all.length,settled:settled.length,exact:settled.filter(row=>row.won).length,
      simulatedRoi:interval.mean,roiLower:interval.lower,roiUpper:interval.upper,
      brier:probabilities.brier,logLoss:probabilities.logLoss,ece:probabilities.ece,
      drawdown:settled.length?drawdown:null,closing:close.length,clv:close.length?close.reduce((a,b)=>a+b,0)/close.length:null,
      delay:delayed.length,delayedRoi:delayed.length?delayed.reduce((a,row)=>a+(row.won?row.delayedOdds!-1:-1),0)/delayed.length:null};
  });
  return {coverage:[...targets].map(([market,row])=>({market,fixtures:row.fixtures.size,snapshots:row.snapshots,withModel:row.withModel})),
    admOpportunities:[],recent,summary};
}

export function archivedPricingPairs(payload:unknown,match:FeedMatch,guard:number){
  if(!payload||typeof payload!=='object')return [];
  const data=payload as {pre_close_basis?:unknown;selections?:unknown};
  if(data.pre_close_basis!=='kickoff'||!Array.isArray(data.selections))return [];
  const fields=['group_id','market_id','market_key','period','side','line','handicap','sel_id'] as const;
  const quotes=data.selections.flatMap(row=>{
    const q=row?.pre_close as FeedQuote|undefined;
    if(!q||typeof q!=='object'||fields.some(key=>row[key]!==q[key])||
      (q.fixture_id&&q.fixture_id!==match.id)||q.suspended!==false||q.phase==='inplay'||
      !Number.isFinite(q.odds_dec)||q.odds_dec<=1)return [];
    const t=Date.parse(q.ts);
    return t<=guard&&guard-t<=300_000?[{...q,fixture_id:match.id,phase:'prematch' as const}]:[];
  });
  const winners=quotes.filter(q=>q.group_id==='920000'&&q.market_id==='920000'&&!q.period&&q.line==='To Win'&&(q.side===match.home||q.side===match.away));
  const groups=grouped(match,quotes,winners,true);
  // Both prices come from the provider's closing snapshot. Keep each quote timestamp.
  return completePairs(match,groups,()=>new Date(guard).toISOString());
}
