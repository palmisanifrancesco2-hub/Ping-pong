import {playerKey,type MatchResult} from './player-model.js';
import {ScoreFeatures} from './score-model.js';
export const MARKET_TARGETS=['winner','first-set','first-set-points-over-19.5','sets-over-3.5','sets-over-4.5','points-over-74.5','points-over-79.5','points-over-84.5','home-set-handicap-minus-1.5','home-set-handicap-plus-1.5','home-point-handicap-minus-5.5','home-point-handicap-plus-5.5','home-point-handicap-minus-9.5','home-point-handicap-plus-9.5'] as const;
const opposite=[0,1,2,3,4,5,6,7,9,8,11,10,13,12];
const directional=new Set([0,1,8,9,10,11,12,13]);
const logistic=(x:number)=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
const logit=(p:number)=>Math.log(Math.max(.001,Math.min(.999,p))/(1-Math.max(.001,Math.min(.999,p))));
type RecordRow={y:number[];summary:number[];available:number};
function summary(m:MatchResult,reverse=false){
 const setA=m.sets.filter(s=>s[0]>s[1]).length,setB=m.sets.length-setA;
 const pointA=m.sets.reduce((n,s)=>n+s[0],0),pointB=m.sets.reduce((n,s)=>n+s[1],0),sign=reverse?-1:1;
 return [Number(reverse?!m.homeWon:m.homeWon),Number((m.sets[0][0]>m.sets[0][1])!==reverse),m.sets.length,pointA+pointB,sign*(setA-setB),sign*(pointA-pointB),m.sets[0][0]+m.sets[0][1],sign*(m.sets[0][0]-m.sets[0][1])];
}
export function marketOutcomes(m:MatchResult,reverse=false){
 const s=summary(m,reverse);
 return [s[0],s[1],Number(s[6]>19.5),Number(s[2]>3.5),Number(s[2]>4.5),Number(s[3]>74.5),Number(s[3]>79.5),Number(s[3]>84.5),Number(s[4]>1.5),Number(s[4]>-1.5),Number(s[5]>5.5),Number(s[5]>-5.5),Number(s[5]>9.5),Number(s[5]>-9.5)];
}
type Aggregate={n:number;y:number[];summary:number[]};
const empty=():Aggregate=>({n:0,y:MARKET_TARGETS.map(()=>0),summary:Array(8).fill(0)});
function add(a:Aggregate,r:RecordRow){a.n++;r.y.forEach((v,i)=>a.y[i]+=v);r.summary.forEach((v,i)=>a.summary[i]+=v);}
export class MarketContext{
 private players=new Map<string,RecordRow[]>();private leagues=new Map<string,Aggregate>();private pairs=new Map<string,RecordRow[]>();private global=empty();private score=new ScoreFeatures();private latest=0;
 update(m:MatchResult){
  const available=Date.parse(m.availableAt);if(!Number.isFinite(available)||available<this.latest)throw Error('MARKET_CONTEXT_ORDER');this.latest=available;
  const a=playerKey(m.league,m.home),b=playerKey(m.league,m.away),home={y:marketOutcomes(m),summary:summary(m),available},away={y:marketOutcomes(m,true),summary:summary(m,true),available};
  this.players.set(a,[...(this.players.get(a)??[]),home].slice(-30));this.players.set(b,[...(this.players.get(b)??[]),away].slice(-30));
  const league=this.leagues.get(m.league)??empty();add(league,home);this.leagues.set(m.league,league);add(this.global,home);
  const pair=JSON.stringify([a,b].sort());this.pairs.set(pair,[...(this.pairs.get(pair)??[]),a<b?home:away].slice(-30));this.score.update(m);
 }
 features(m:Pick<MatchResult,'home'|'away'|'league'>,at:number,minimum=30){
  if(this.latest>=at)throw Error('MARKET_CONTEXT_FUTURE_DATA');
  const base=this.score.features(m,at,minimum);if(!base)return null;
  const ak=playerKey(m.league,m.home),bk=playerKey(m.league,m.away),a=this.players.get(ak)??[],b=this.players.get(bk)??[],l=this.leagues.get(m.league)??empty();
  const global=this.global.y.map(v=>this.global.n?v/this.global.n:.5),baseline=l.y.map((v,i)=>(v+50*global[i])/(l.n+50));
  const pair=this.pairs.get(JSON.stringify([ak,bk].sort()))??[];
  const eb=baseline.map((prior,i)=>{
    const pa=(a.reduce((n,r)=>n+r.y[i],0)+20*prior)/(a.length+20);
    const j=opposite[i],bp=directional.has(i)?1-(b.reduce((n,r)=>n+r.y[j],0)+20*(1-prior))/(b.length+20):(b.reduce((n,r)=>n+r.y[i],0)+20*prior)/(b.length+20);
    const pairP=logistic((logit(pa)+logit(bp))/2);
    const h=pair.reduce((n,r)=>n+(ak<bk?r.y[i]:directional.has(i)?1-r.y[j]:r.y[i]),0),hP=(h+20*prior)/(pair.length+20),weight=.2*pair.length/(pair.length+20);
    return (1-weight)*pairP+weight*hP;
  });
  const scales=[1,1,5,100,3,30,25,15];
  const mean=(rows:RecordRow[],i:number)=>{const prior=l.n?l.summary[i]/l.n:this.global.summary[i]/Math.max(1,this.global.n);return (rows.reduce((n,r)=>n+r.summary[i],0)+20*prior)/(rows.length+20)/scales[i];};
  const x=[...base.x,...baseline,...eb,...Array.from({length:8},(_,i)=>mean(a,i)),...Array.from({length:8},(_,i)=>mean(b,i)),...Array.from({length:8},(_,i)=>{const aa=a.slice(-10),bb=b.slice(-10);return mean(aa,i)-mean(bb,i);}),Math.min(1,pair.length/30),Math.min(1,a.length/30),Math.min(1,b.length/30)];
  if(!x.every(Number.isFinite))throw Error('MARKET_CONTEXT_INVALID');
  return{x,baseline,eb,available:this.latest,sampleSize:base.sampleSize,summary:undefined};
 }
}
export type MarketRow={id:string;at:number;available:number;featuresAvailable:number;league:string;x:number[];baseline:number[];eb:number[];y:number[];sampleSize:number};
export function marketRows(results:MatchResult[],starts:{id:string;at:number}[],minimum=30):MarketRow[]{
 const ordered=[...results].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id)),byId=new Map(results.map(r=>[r.id,r])),context=new MarketContext(),seen=new Set<string>(),rows:MarketRow[]=[];let index=0;
 for(const s of [...starts].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){const m=byId.get(s.id);if(!m||seen.has(s.id))continue;seen.add(s.id);if(!Number.isFinite(s.at)||s.at>=Date.parse(m.finishedAt))continue;
  while(index<ordered.length&&Date.parse(ordered[index].availableAt)<s.at)context.update(ordered[index++]);
  const f=context.features(m,s.at,minimum);if(!f)continue;
  const wins=Math.max(m.sets.filter(s=>s[0]>s[1]).length,m.sets.filter(s=>s[0]<s[1]).length);if(wins!==3)continue;
  rows.push({id:m.id,at:s.at,available:Date.parse(m.availableAt),featuresAvailable:f.available,league:m.league,x:f.x,baseline:f.baseline,eb:f.eb,y:marketOutcomes(m),sampleSize:f.sampleSize});
 }return rows;
}
