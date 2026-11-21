export type MatchResult = { id:string;home:string;away:string;league:string;finishedAt:string;availableAt:string;homeWon:boolean;sets:[number,number][] };
export type Rating = { rating:number;count:number };
export const playerKey=(league:string,name:string)=>JSON.stringify([league.normalize('NFKC').trim().toLowerCase(),name.normalize('NFKC').trim().toLowerCase()]);
export function eloProbability(a:number,b:number){return 1/(1+10**((b-a)/400));}
export function updateRatings(ratings:Record<string,Rating>,m:MatchResult){
  const ak=playerKey(m.league,m.home),bk=playerKey(m.league,m.away);const a=ratings[ak]??{rating:1500,count:0},b=ratings[bk]??{rating:1500,count:0};
  const change=20*((m.homeWon?1:0)-eloProbability(a.rating,b.rating));
  ratings[ak]={rating:a.rating+change,count:a.count+1};ratings[bk]={rating:b.rating-change,count:b.count+1};
}
export function calibratedProbability(p:number,a:number,b:number){const c=Math.min(.999,Math.max(.001,p));return 1/(1+Math.exp(-(a*Math.log(c/(1-c))+b)));}
export function fitCalibration(samples:{p:number;y:number}[]){
  let a=1,b=0;for(let i=0;i<1500;i++){let da=.05*(a-1),db=.05*b;for(const s of samples){const x=Math.log(s.p/(1-s.p));const d=calibratedProbability(s.p,a,b)-s.y;da+=d*x/samples.length;db+=d/samples.length;}a-=.03*da;b-=.03*db;a=Math.max(.1,Math.min(3,a));b=Math.max(-1,Math.min(1,b));}return{a,b};
}
export function modelMetrics(samples:{p:number;y:number}[]){
  if(!samples.length)return{n:0,brier:null,logLoss:null,ece:null};
  let brier=0,loss=0,ece=0;for(const s of samples){brier+=(s.p-s.y)**2;const p=Math.max(1e-9,Math.min(1-1e-9,s.p));loss-=s.y*Math.log(p)+(1-s.y)*Math.log(1-p);}
  for(let i=0;i<5;i++){const bin=samples.filter(s=>Math.min(4,Math.floor(s.p*5))===i);if(bin.length)ece+=Math.abs(bin.reduce((n,s)=>n+s.p-s.y,0))/samples.length;}
  return{n:samples.length,brier:brier/samples.length,logLoss:loss/samples.length,ece};
}
export function playerStats(results:MatchResult[],league:string,name:string){
  const key=playerKey(league,name);const rows=results.filter(m=>playerKey(m.league,m.home)===key||playerKey(m.league,m.away)===key).sort((a,b)=>Date.parse(b.finishedAt)-Date.parse(a.finishedAt));
  let wins=0,setsFor=0,setsAgainst=0,pointsFor=0,pointsAgainst=0;
  const recent=rows.slice(0,20).map(m=>{const home=playerKey(m.league,m.home)===key;const won=home===m.homeWon;return{eventId:m.id,date:m.finishedAt,opponent:home?m.away:m.home,won,score:m.sets.map(([a,b])=>home?`${a}-${b}`:`${b}-${a}`).join(', ')};});
  for(const m of rows){const home=playerKey(m.league,m.home)===key;if(home===m.homeWon)wins++;for(const [a,b]of m.sets){const x=home?a:b,y=home?b:a;pointsFor+=x;pointsAgainst+=y;if(x>y)setsFor++;else setsAgainst++;}}
  return{name,matches:rows.length,wins,losses:rows.length-wins,winRate:rows.length?wins/rows.length:null,setsFor,setsAgainst,pointsFor,pointsAgainst,recent};
}
