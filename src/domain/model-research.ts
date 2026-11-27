import {eloProbability,playerKey,type MatchResult,modelMetrics} from './player-model.js';
export const candidates=['elo10','elo20','elo40','elo80','form20','elo40-form20'] as const;
export type Candidate=typeof candidates[number];
type State={elo:number[];wins:number[];count:number};
/** Online ratings are updated only when a result was available before prediction. */
export class ResearchRatings{
 private players=new Map<string,State>();
 private get(key:string):State{return this.players.get(key)??{elo:[1500,1500,1500,1500],wins:[],count:0};}
 update(m:MatchResult){
  const ak=playerKey(m.league,m.home),bk=playerKey(m.league,m.away);
  const a=this.get(ak),b=this.get(bk),y=Number(m.homeWon),steps=[10,20,40,80];
  const changes=steps.map((k,i)=>k*(y-eloProbability(a.elo[i],b.elo[i])));
  this.players.set(ak,{elo:a.elo.map((r,i)=>r+changes[i]),wins:[...a.wins,y].slice(-20),count:a.count+1});
  this.players.set(bk,{elo:b.elo.map((r,i)=>r-changes[i]),wins:[...b.wins,1-y].slice(-20),count:b.count+1});
 }
 predict(m:Pick<MatchResult,'league'|'home'|'away'>,minimum=20):Record<Candidate,number>|null{
  const a=this.get(playerKey(m.league,m.home)),b=this.get(playerKey(m.league,m.away));
  if(Math.min(a.count,b.count)<minimum)return null;
  const ep=a.elo.map((r,i)=>eloProbability(r,b.elo[i]));
  // Beta(5,5) smoothing; comparative log odds, explicitly not opponent-adjusted.
  const rate=(s:State)=>(5+s.wins.reduce((n,v)=>n+v,0))/(10+s.wins.length);
  const ar=rate(a),br=rate(b),form=ar*(1-br)/(ar*(1-br)+br*(1-ar));
  return{elo10:ep[0],elo20:ep[1],elo40:ep[2],elo80:ep[3],form20:form,'elo40-form20':(ep[2]+form)/2};
 }
}
export type ResearchRow={id:string;at:number;available:number;league:string;y:number;p:Record<Candidate,number>};
export function researchRows(results:MatchResult[],starts:{id:string;at:number}[],minimum=20){
 const ordered=[...results].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt)||a.id.localeCompare(b.id));
 const byId=new Map(ordered.map(r=>[r.id,r]));const seen=new Set<string>();const ratings=new ResearchRatings();let index=0;const rows:ResearchRow[]=[];
 for(const start of [...starts].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){
  if(seen.has(start.id))continue;seen.add(start.id);const m=byId.get(start.id);
  if(!m||!Number.isFinite(start.at)||start.at>=Date.parse(m.finishedAt))continue;
  while(index<ordered.length&&Date.parse(ordered[index].availableAt)<start.at)ratings.update(ordered[index++]);
  const p=ratings.predict(m,minimum);if(p)rows.push({id:m.id,at:start.at,available:Date.parse(m.availableAt),league:m.league,y:Number(m.homeWon),p});
 }
 return rows;
}
export function chooseCandidate(rows:ResearchRow[]):Candidate{
 if(!rows.length)throw Error('NO_SELECTION_DATA');
 return [...candidates].sort((a,b)=>modelMetrics(rows.map(r=>({p:r.p[a],y:r.y}))).brier!-modelMetrics(rows.map(r=>({p:r.p[b],y:r.y}))).brier!)[0];
}
/** Day-cluster paired Brier difference; equal day weight, Student t interval.
 * Days are not guaranteed independent: this is a diagnostic, not certification. */
export function dayClusterDifference(rows:{at:number;p:number;y:number;baseline:number}[]){
 const days=new Map<string,number[]>();for(const r of rows){const day=new Date(r.at).toISOString().slice(0,10);const values=days.get(day)??[];values.push((r.p-r.y)**2-(r.baseline-r.y)**2);days.set(day,values);}
 const means=[...days.values()].map(v=>v.reduce((a,b)=>a+b,0)/v.length),n=means.length;
 if(n<2)return{days:n,mean:null,lower95:null,upper95:null};
 const mean=means.reduce((a,b)=>a+b,0)/n,se=Math.sqrt(means.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)/n);
 const t=n===2?12.706:n===3?4.303:n===4?3.182:n===5?2.776:n<=10?2.571:n<=20?2.262:2.093;
 return{days:n,mean,lower95:mean-t*se,upper95:mean+t*se};
}
export {wilsonInterval} from './statistical-interval.js';
