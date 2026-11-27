import{describe,it,expect,vi}from'vitest';
import{choiceSnapshot,Choices,saveChoiceSchema}from'../server/choices';
import{quoteIdentity,type Board}from'../src/shared/board';
import {runtimeModel,scoreWinnerEstimate} from '../server/score-signals';
import {estimateChoice,matchChoiceResult,readComparison,signForecast,type StoredChoice} from '../server/choice-forecast';
import type {ResultsArchive} from '../server/results';
const now=Date.parse('2026-11-04T12:00:00Z');
const q={fixture_id:'e',group_id:'winner',sel_id:'a',label:'Test A',odds_dec:2.1,ts:new Date(now).toISOString()};
const board:Board={provider:'MoviOdds',bookmakerSite:'bet365.com.au',checkedAt:new Date(now).toISOString(),serverTime:new Date(now).toISOString(),warming:false,matches:[{id:'e',sport:'table_tennis',home:'Test A',away:'Test B',league:'Test league',in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),group_status:{winner:{polled_at:new Date(now).toISOString()}},quotes:[q]}]};
const env={SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC'};
describe('personal choices and immutable price snapshots',()=>{
 it('saves the provider price and selection separately from watch-only games',()=>{
  expect(choiceSnapshot(board,'e',undefined,now).selection).toBeNull();
  expect(choiceSnapshot(board,'e',quoteIdentity(q),now).selection).toMatchObject({label:'Test A',odds:2.1,quoteAt:q.ts});
 });
 it('rejects gone events, stale or suspended prices and forged snapshot input',()=>{
  expect(()=>choiceSnapshot(board,'gone',undefined,now)).toThrow();
  expect(()=>choiceSnapshot(board,'e',quoteIdentity(q),now+180000)).toThrow();
  expect(saveChoiceSchema.safeParse({eventId:'e',odds:1000,userId:'other'}).success).toBe(false);
 });
 it('keeps the first saved price on repeat clicks and sends caller JWT and ownership',async()=>{
  let calls=0;const fetcher=vi.fn(async(input:URL|RequestInfo,init?:RequestInit)=>{expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token');const url=new URL(String(input));
   if(calls++===0){expect(init?.method).toBe('POST');expect(JSON.parse(String(init?.body))).toMatchObject({user_id:'owner',event_source_id:'e'});return Response.json({code:'23505'},{status:409});}
   expect(init?.method).toBe('GET');expect(url.searchParams.get('user_id')).toBe('eq.owner');return Response.json({id:'first',snapshot:{selection:{odds:1.9}}});});
  const result=await new Choices(env,fetcher,()=>now).save('token','owner',{eventId:'e',quoteKey:quoteIdentity(q),expectedOdds:q.odds_dec,expectedUpdatedAt:q.ts,notes:''},board);
  expect(result.snapshot.selection?.odds).toBe(1.9);expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('refuses a price that changed since the user selected it',async()=>{
  const fetcher=vi.fn();await expect(new Choices(env,fetcher,()=>now).save('token','owner',{eventId:'e',quoteKey:quoteIdentity(q),expectedOdds:1.8,expectedUpdatedAt:q.ts,notes:''},board)).rejects.toThrow('CHOICE_QUOTE_UNAVAILABLE');expect(fetcher).not.toHaveBeenCalled();
 });
 it('does not allow settling a watched game with no chosen selection',async()=>{
  const fetcher=vi.fn(async()=>Response.json({snapshot:{selection:null}}));
  await expect(new Choices(env,fetcher,()=>now).update('t','owner',{id:'11111111-1111-4111-8111-111111111111',status:'won',notes:''})).rejects.toThrow('CHOICE_WATCH_ONLY');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
});

describe('automatic personal forecast outcomes',()=>{
 const key='service-role-value-for-test';
 const signedEnv={...env,SUPABASE_SERVICE_ROLE_KEY:key};
 const at=Date.parse(runtimeModel.generatedAt)+2*86_400_000;
 const iso=(ms:number)=>new Date(ms).toISOString();
 const price={...q,group_id:'920000',side:'Test A',line:'To Win',ts:iso(at-30_000)};
 const otherPrice={...price,side:'Test B',sel_id:'b',label:'Test B',odds_dec:1.8};
 const match={...board.matches[0],kickoff_utc:iso(at+3600_000),
   group_status:{'920000':{polled_at:iso(at)}},quotes:[price,otherPrice]};
 const currentBoard={...board,matches:[match]};
 const homeSets:[[number,number],[number,number],[number,number]]=[[11,5],[11,7],[11,9]];
 const past=Array.from({length:32},(_,index)=>({
   id:'past-'+index,home:match.home,away:match.away,league:match.league,homeWon:true,sets:homeSets,
   finishedAt:iso(at-(32-index)*120_000),availableAt:iso(at-(32-index)*120_000+10_000),
 }));
 const archive={results:past,source:'postgres',checkedAt:iso(at),from:null,to:null,rejected:0};
 const final={...past[0],id:'e',finishedAt:iso(at+5_400_000),availableAt:iso(at+5_460_000)};
 const estimate=scoreWinnerEstimate(match,archive,at)!;
 const expectedForecast={selection:match.home,probability:estimate.homeProbability,model:estimate.modelName};
 const entry={id:'first',event_source_id:'e',choice_key:'event',saved_at:iso(at),manual_status:'pending'};

 it('verifies a displayed forecast, persists the final and keeps it if the source goes offline',async()=>{
   let row:Record<string,unknown>={};
   let current=at;
   let provider:ResultsArchive|undefined=archive;
   const archiveRequest=vi.fn(async()=>{if(!provider)throw Error('OFFLINE');return provider;});
   const fetcher=vi.fn(async(input:URL|RequestInfo,init?:RequestInit)=>{
     const url=new URL(String(input));
     if(init?.method==='POST'){
       expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
       row={...entry,...JSON.parse(String(init.body))};
       return Response.json(row);
     }
     expect(url.searchParams.get('user_id')).toBe('eq.owner');
     if(init?.method==='PATCH'){
       expect(new Headers(init.headers).get('authorization')).toBe('Bearer '+key);
       expect(url.searchParams.get('id')).toBe('eq.first');
       row={...row,...JSON.parse(String(init.body))};
       return new Response(null,{status:204});
     }
     return Response.json([row],{headers:{'content-range':'0-0/1'}});
   });
   const choices=new Choices(signedEnv,fetcher,()=>current,archiveRequest);
   const prices={fairOdds:1/estimate.homeProbability,bet365:{odds:2.1,quoteAt:price.ts,key:quoteIdentity(price)}};
   const saved=await choices.save('token','owner',{eventId:'e',notes:'',expectedForecast},currentBoard);
   expect(saved.comparison?.forecast.prices).toEqual(prices);
   const load=()=>choices.list('token','owner','all',1,'all');
   expect((await load()).entries[0].comparison).toEqual({forecast:{...expectedForecast,phase:'prematch',prices},result:null});
   expect(archiveRequest).toHaveBeenCalledTimes(1);

   current=at+6_000_000;
   provider={...archive,results:[...past,final]};
   const settled=(await load()).entries[0];
   expect(settled.comparison?.result).toEqual({winner:match.home,sets:homeSets,finishedAt:final.finishedAt});
   expect(settled.comparison?.forecast.prices).toEqual(prices);
   expect(settled.snapshot).not.toHaveProperty('modelResult');
   expect(settled.manual_status).toBe('pending');
   provider=undefined;
   expect((await load()).entries[0]).toEqual(settled);
   expect(archiveRequest).toHaveBeenCalledTimes(2);
 });

 it('saves the selected side’s price and never substitutes a stale or opposing price',()=>{
   const selected=choiceSnapshot(currentBoard,'e',quoteIdentity(otherPrice),at);
   const forecast=estimateChoice(match,selected,archive,false,at);
   expect(forecast).toMatchObject({selection:match.away,prices:{fairOdds:1/(1-estimate.homeProbability),
     bet365:{odds:1.8,quoteAt:price.ts,key:quoteIdentity(otherPrice)}}});
   const watch=choiceSnapshot(currentBoard,'e',undefined,at);
   expect(estimateChoice({...match,quotes:[otherPrice]},watch,archive,false,at)?.prices?.bet365).toBeNull();
   expect(estimateChoice({...match,quotes:[{...price,suspended:true},otherPrice]},watch,archive,false,at)?.prices?.bet365).toBeNull();
 });

 it('preserves old forecasts and detects edits to saved prices',()=>{
   const snapshot=choiceSnapshot(currentBoard,'e',undefined,at);
   const forecast={...expectedForecast,phase:'prematch' as const};
   const old={...entry,snapshot:{...snapshot,modelForecast:forecast,forecastSignature:signForecast(key,'owner','event',snapshot,forecast)}} as StoredChoice;
   expect(readComparison(key,'owner',old)).toEqual({forecast,result:null});
   const newForecast=estimateChoice(match,snapshot,archive,false,at)!;
   const updated={...old,snapshot:{...snapshot,modelForecast:newForecast,forecastSignature:signForecast(key,'owner','event',snapshot,newForecast)}};
   expect(readComparison(key,'owner',updated)?.forecast.prices?.bet365?.odds).toBe(2.1);
   newForecast.prices!.bet365!.odds=5;
   expect(readComparison(key,'owner',updated)).toBeUndefined();
 });

 it('matches reversed players, but rejects an earlier result or a different competition',()=>{
   const snapshot=choiceSnapshot(currentBoard,'e',undefined,at);
   const wrong={...final,home:match.away,away:match.home};
   expect(matchChoiceResult(snapshot,wrong,at+6_000_000)?.winner).toBe(match.away);
   expect(matchChoiceResult(snapshot,{...final,finishedAt:iso(at)},at+6_000_000)).toBeUndefined();
   expect(matchChoiceResult(snapshot,{...final,league:'Different'},at+6_000_000)).toBeUndefined();
 });

 it('rejects a changed forecast and ignores unauthorized forecast claims in storage',async()=>{
   const row={...entry,snapshot:{...choiceSnapshot(currentBoard,'e',undefined,at),
     modelForecast:{...expectedForecast,phase:'prematch'},forecastSignature:'bad'}};
   const fetcher=vi.fn(async()=>Response.json([row],{headers:{'content-range':'0-0/1'}}));
   const choices=new Choices(signedEnv,fetcher,()=>at,async()=>archive);
   await expect(choices.save('token','owner',{eventId:'e',notes:'',expectedForecast:{...expectedForecast,selection:match.away}},currentBoard))
     .rejects.toThrow('CHOICE_FORECAST_UNAVAILABLE');
   expect(fetcher).not.toHaveBeenCalled();
   expect((await choices.list('token','owner','all',1,'all')).entries[0].comparison).toBeUndefined();
 });
});
