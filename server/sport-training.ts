import { z } from 'zod';
import { movioddsRequest } from './moviodds-request.js';
import type { Env } from './auth.js';
import type { AdditionalSport } from '../src/shared/individual-sports.js';
import type { SportTraining, WinnerMetrics } from '../src/shared/sport-training.js';
import { eloProbability } from '../src/domain/player-model.js';

const date=z.iso.datetime({offset:true});
const resultSchema=z.object({
  fixture_id:z.string().min(1),
  sport:z.string(),home:z.string().min(1),away:z.string().min(1),league:z.string().min(1),
  status:z.literal('finished'),final_score:z.string(),finished_at:date,
  kickoff_utc:date.nullish(),updated_at:date.nullish(),
  periods:z.array(z.object({score:z.string().max(30)})).max(15).nullish(),
  fight:z.object({result:z.enum(['home','away','draw','no_contest'])}).nullish(),
});
const day=86_400_000;
const key=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
const binaryScore=/^(\d{1,3})\s*-\s*(\d{1,3})$/;
const excludedPairs=/\/|\s(?:&|\+)\s/;
const teamEvents=/\b(?:doubles?|teams?|pairs?)\b/i;
type Result={id:string;home:string;away:string;league:string;finished:number;cutoff:number;available:number;scheduled:boolean;reported:boolean;won:number};

function matchOutcome(sport:AdditionalSport,result:z.infer<typeof resultSchema>) {
  if (sport==='boxing'||sport==='mma') {
    if (result.fight?.result==='home'&&result.final_score==='1-0') return 1;
    if (result.fight?.result==='away'&&result.final_score==='0-1') return 0;
    return;
  }
  const totals=binaryScore.exec(result.final_score.trim());
  if (totals) {
    const a=Number(totals[1]),b=Number(totals[2]);
    if (a===b) return;
    if (sport==='tennis'&&![2,3].includes(Math.max(a,b))) return;
    if (sport==='badminton'&&Math.max(a,b)!==2) return;
    return Number(a>b);
  }
  if (sport!=='tennis'&&sport!=='badminton') return;
  const parts=result.final_score.split(',');
  let a=0,b=0;
  for (const score of parts) {
    const set=binaryScore.exec(score.trim());
    if (!set) return;
    const first=Number(set[1]),second=Number(set[2]);
    const high=Math.max(first,second),low=Math.min(first,second);
    const complete=sport==='badminton' ? (high===21&&low<=19)||(high>21&&high<30&&high-low===2)||(high===30&&[28,29].includes(low))
      : (high===6&&low<=4)||(high===7&&[5,6].includes(low))||(high===10&&low<=8);
    if (!complete) return;
    if (first>second) a++;else b++;
  }
  if(a===b||!(sport==='tennis'?[2,3]:[2]).includes(Math.max(a,b)))return;
  return Number(a>b);
}

function acceptedResult(input:unknown,sport:AdditionalSport,now:number):Result|undefined {
  const parsed=resultSchema.safeParse(input);
  if (!parsed.success||parsed.data.sport!==sport) return;
  const row=parsed.data, home=key(row.home),away=key(row.away);
  if (!home||!away||home===away||teamEvents.test(row.league)||excludedPairs.test(home)||excludedPairs.test(away)) return;
  const won=matchOutcome(sport,row);
  const finished=Date.parse(row.finished_at);
  if (won===undefined||finished>now) return;
  const starts=Date.parse(row.kickoff_utc??'');
  const scheduled=Number.isFinite(starts)&&starts<finished;
  const updated=Date.parse(row.updated_at??'');
  const reported=Number.isFinite(updated)&&updated>=finished&&updated<=now;
  if (Number.isFinite(updated)&&updated>now) return;
  return {id:row.fixture_id,home,away,league:key(row.league),finished,
    cutoff:scheduled ? starts : Math.floor(finished/day)*day-day,
    available:reported ? updated : finished+day,scheduled,reported,won};
}

const baseline=(delta:number)=>eloProbability(delta*400,0);
const sigmoid=(x:number)=>1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));
type Example={at:number;x:number[];won:number};
type Rating={elo:number;wins:number;games:number};

function trainingExamples(rows:Result[]):Example[] {
  const byAvailability=[...rows].sort((a,b)=>a.available-b.available||a.id.localeCompare(b.id));
  const byCutoff=[...rows].sort((a,b)=>a.cutoff-b.cutoff||a.id.localeCompare(b.id));
  const global=new Map<string,Rating>(),competition=new Map<string,Rating>();
  const initial={elo:1500,wins:0,games:0};
  const get=(ratings:Map<string,Rating>,name:string)=>ratings.get(name)??initial;
  const local=(league:string,name:string)=>JSON.stringify([league,name]);
  const update=(ratings:Map<string,Rating>,first:string,second:string,won:number)=>{
    const a=get(ratings,first), b=get(ratings,second);
    const change=24*(won-eloProbability(a.elo,b.elo));
    ratings.set(first,{elo:a.elo+change,wins:a.wins+won,games:a.games+1});
    ratings.set(second,{elo:b.elo-change,wins:b.wins+1-won,games:b.games+1});
  };
  let cursor=0;
  const output:Example[]=[];
  for(const row of byCutoff){
    while(cursor<byAvailability.length&&byAvailability[cursor].available<row.cutoff){
      const past=byAvailability[cursor++];
      update(global,past.home,past.away,past.won);
      update(competition,local(past.league,past.home),local(past.league,past.away),past.won);
    }
    const a=get(global,row.home),b=get(global,row.away);
    if(Math.min(a.games,b.games)<4) continue;
    const al=get(competition,local(row.league,row.home)),bl=get(competition,local(row.league,row.away));
    output.push({at:row.cutoff,won:row.won,x:[(a.elo-b.elo)/400,(al.elo-bl.elo)/400,
      (a.wins+3)/(a.games+6)-(b.wins+3)/(b.games+6),Math.log1p(a.games)-Math.log1p(b.games)]});
  }
  return output;
}

function fit(rows:Example[],dimensions:number) {
  const weights=Array(dimensions).fill(0) as number[];
  for(let step=0;step<220;step++){
    const gradient=weights.map(w=>.01*w);
    for(const {x,won} of rows){
      const residual=(sigmoid(weights.reduce((sum,w,i)=>sum+w*x[i],0))-won)/rows.length;
      for(let i=0;i<dimensions;i++)gradient[i]+=residual*x[i];
    }
    for(let i=0;i<dimensions;i++) weights[i]-=.65*gradient[i];
  }
  return {coefficients:weights,predict:(x:number[])=>sigmoid(weights.reduce((sum,w,i)=>sum+w*x[i],0))};
}

function score(rows:Example[],predict:(x:number[])=>number):WinnerMetrics {
  let hits=0,brier=0,loss=0;
  for(const {x,won} of rows){
    const p=Math.min(1-1e-9,Math.max(1e-9,predict(x)));
    hits+=Number(p===.5 ? won===1 : (p>.5)===(won===1));
    brier+=(p-won)**2;
    loss-=won*Math.log(p)+(1-won)*Math.log1p(-p);
  }
  return {n:rows.length,hits,accuracy:hits/rows.length,brier:brier/rows.length,logLoss:loss/rows.length};
}

export function evaluateSport(sport:AdditionalSport,payload:unknown,now:number):SportTraining {
  const parsed=z.object({source:z.enum(['postgres','memory']),results:z.array(z.unknown()).max(100_000)}).parse(payload);
  const byId=new Map<string,Result>(),ambiguous=new Set<string>();
  for(const raw of parsed.results){
    const result=acceptedResult(raw,sport,now);
    if(!result)continue;
    const previous=byId.get(result.id);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(result))ambiguous.add(result.id);
    else byId.set(result.id,result);
  }
  const rows=[...byId.values()].filter(row=>!ambiguous.has(row.id)).sort((a,b)=>a.finished-b.finished);
  const examples=trainingExamples(rows);
  const dates=[...new Set(examples.map(example=>Math.floor(example.at/day)))];
  const validationStart=dates[Math.floor(dates.length*.6)]??Infinity;
  const testStart=dates[Math.floor(dates.length*.8)]??Infinity;
  const train=examples.filter(x=>x.at<(validationStart-1)*day);
  const calibration=examples.filter(x=>x.at>=validationStart*day&&x.at<(testStart-1)*day);
  const test=examples.filter(x=>x.at>=testStart*day);
  const covered=(set:Example[],minimum:number)=>set.length>=minimum&&new Set(set.map(row=>row.won)).size===2;
  const result:SportTraining={sport,source:parsed.source,raw:parsed.results.length,complete:rows.length,
    withScheduledStart:rows.filter(row=>row.scheduled).length,withPublication:rows.filter(row=>row.reported).length,
    eligible:examples.length,from:rows.length?new Date(rows[0].finished).toISOString():null,
    to:rows.length?new Date(rows.at(-1)!.finished).toISOString():null,train:train.length,calibration:calibration.length,test:test.length,
    selected:null,candidates:[],checkedAt:new Date(now).toISOString()};
  if (parsed.source!=='postgres'||!covered(train,100)||!covered(calibration,40)||!covered(test,40)) return result;
  const models=[
    {name:'Elo',predict:(x:number[])=>baseline(x[0]),coefficients:undefined},
    {name:'Elo calibrato',...fit(train,1)},
    {name:'Logistica Elo e storico',...fit(train,4)},
  ];
  const ordered=models.map(model=>({...model,calibration:score(calibration,model.predict)}))
    .sort((a,b)=>a.calibration.logLoss-b.calibration.logLoss);
  result.selected=ordered[0].name;
  result.candidates=ordered.map(({name,predict,calibration,coefficients})=>({name,calibration,coefficients,test:score(test,predict)}));
  return result;
}

export async function trainSport(sport:AdditionalSport,env:Env,now=Date.now()):Promise<SportTraining> {
  const response=await movioddsRequest(`https://moviodds.com/results?sport=${sport}`,{signal:AbortSignal.timeout(28_000),cache:'no-store'},fetch,env);
  if(!response.ok||!response.body) throw Error(`RESULTS_HTTP_${response.status}`);
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];
  let size=0;
  try{
    for(;;){
      const chunk=await reader.read();
      if(chunk.done)break;
      size+=chunk.value.byteLength;
      if(size>20_000_000)throw Error('RESULTS_PAYLOAD_LIMIT');
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel().catch(()=>{}); }
  const text=Buffer.concat(chunks).toString('utf8');
  return evaluateSport(sport,JSON.parse(text),now);
}
