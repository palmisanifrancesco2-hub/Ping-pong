import {eloProbability,playerKey,type MatchResult} from './player-model.js';
type Performance={at:number;win:number;pointsFor:number;pointsAgainst:number;setsFor:number;setsAgainst:number};
type Player={rating:number;count:number;recent:Performance[]};
export type FeatureRow={id:string;at:number;available:number;y:number;league:string;x:number[];elo:number};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export const sigmoid=(x:number)=>1/(1+Math.exp(-clamp(x,-30,30)));
/** Each caller must update only with results available strictly before prediction. */
export class ScoreFeatures{
 private players=new Map<string,Player>();
 private pairs=new Map<string,{wins:number;count:number}>();
 private player(key:string):Player{return this.players.get(key)??{rating:1500,count:0,recent:[]};}
 update(m:MatchResult){
  const ak=playerKey(m.league,m.home),bk=playerKey(m.league,m.away),a=this.player(ak),b=this.player(bk),y=Number(m.homeWon);
  const change=20*(y-eloProbability(a.rating,b.rating));
  const pf=m.sets.reduce((n,s)=>n+s[0],0),pa=m.sets.reduce((n,s)=>n+s[1],0),sf=m.sets.filter(s=>s[0]>s[1]).length,sa=m.sets.length-sf;
  const add=(p:Player,win:number,pointsFor:number,pointsAgainst:number,setsFor:number,setsAgainst:number,rating:number):Player=>({rating,count:p.count+1,recent:[...p.recent,{at:Date.parse(m.finishedAt),win,pointsFor,pointsAgainst,setsFor,setsAgainst}].sort((a,b)=>a.at-b.at).slice(-30)});
  this.players.set(ak,add(a,y,pf,pa,sf,sa,a.rating+change));this.players.set(bk,add(b,1-y,pa,pf,sa,sf,b.rating-change));
  const pair=JSON.stringify([ak,bk].sort()),old=this.pairs.get(pair)??{wins:0,count:0};
  this.pairs.set(pair,{wins:old.wins+(ak<bk?y:1-y),count:old.count+1});
 }
 features(m:Pick<MatchResult,'league'|'home'|'away'>,at:number,minimum=20){
  const ak=playerKey(m.league,m.home),bk=playerKey(m.league,m.away),a=this.player(ak),b=this.player(bk);
  if(Math.min(a.count,b.count)<minimum||!Number.isFinite(at))return null;
  const stats=(p:Player)=>{
   const r=p.recent.slice(-20),sum=(key:keyof Omit<Performance,'at'>)=>r.reduce((n,s)=>n+s[key],0);
   const pf=sum('pointsFor'),pa=sum('pointsAgainst'),sf=sum('setsFor'),sa=sum('setsAgainst');
   const wins=(n:number)=>{const rows=p.recent.slice(-n);return(5+rows.reduce((t,s)=>t+s.win,0))/(10+rows.length);};
   return{point:(pf+50)/(pf+pa+100),set:(sf+5)/(sf+sa+10),w10:wins(10),w30:wins(30),rest:clamp((at-(p.recent.at(-1)?.at??at))/86400000,0,3)/3,load:p.recent.filter(r=>r.at>=at-86400000&&r.at<at).length/10};
  };
  const x=stats(a),z=stats(b),pair=this.pairs.get(JSON.stringify([ak,bk].sort()));
  const h=pair?(2*pair.wins-pair.count)/(pair.count+10)*(ak<bk?1:-1):0;
  return{x:[(a.rating-b.rating)/400,(x.point-z.point)*10,(x.set-z.set)*4,(x.w10-z.w10)*2,(x.w30-z.w30)*2,h,x.rest-z.rest,x.load-z.load],elo:eloProbability(a.rating,b.rating),sampleSize:Math.min(a.count,b.count)};
 }
}
export function featureRows(results:MatchResult[],starts:{id:string;at:number}[],minimum=20){
 const ordered=[...results].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id)),byId=new Map(ordered.map(r=>[r.id,r]));
 const engine=new ScoreFeatures(),seen=new Set<string>();let i=0;const rows:FeatureRow[]=[];
 for(const s of [...starts].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){
  const m=byId.get(s.id);if(!m||seen.has(s.id)||!Number.isFinite(s.at)||s.at>=Date.parse(m.finishedAt))continue;seen.add(s.id);
  while(i<ordered.length&&Date.parse(ordered[i].availableAt)<s.at)engine.update(ordered[i++]);
  const f=engine.features(m,s.at,minimum);if(f)rows.push({id:m.id,at:s.at,available:Date.parse(m.availableAt),league:m.league,y:Number(m.homeWon),x:f.x,elo:f.elo});
 }
 return rows;
}
export const featureGroups:Record<string,number[]>={scores:[0,1,2],full:[0,1,2,3,4,5,6,7],form:[0,3,4,5,6,7]};
export type LogisticModel={indices:number[];weights:number[];lambda:number};
export function predictScore(model:LogisticModel,x:number[],temperature=1){
 if(x.length!==8||!x.every(Number.isFinite)||!Number.isFinite(temperature)||temperature<=0)throw Error('INVALID_FEATURES');
 return sigmoid(model.weights.reduce((s,w,i)=>s+w*x[model.indices[i]],0)*temperature);
}
export function fitScore(rows:{x:number[];y:number}[],indices:number[],lambda:number):LogisticModel{
 if(rows.length<20||!Number.isFinite(lambda)||lambda<=0||indices.some(i=>!Number.isInteger(i)||i<0||i>7)||rows.some(r=>r.x.length!==8||!r.x.every(Number.isFinite)||![0,1].includes(r.y)))throw Error('INVALID_TRAINING_DATA');
 const weights=indices.map(()=>0);
 for(let step=0;step<2500;step++){
  const gradient=weights.map(w=>lambda*w);
  for(const r of rows){const d=sigmoid(weights.reduce((s,w,i)=>s+w*r.x[indices[i]],0))-r.y;for(let j=0;j<weights.length;j++)gradient[j]+=d*r.x[indices[j]]/rows.length;}
  for(let j=0;j<weights.length;j++)weights[j]-=.1*gradient[j];
 }
 return{indices:[...indices],weights,lambda};
}
