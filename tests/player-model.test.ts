import{describe,it,expect}from'vitest';
import{createHash}from'node:crypto';
import{parseResult}from'../server/results';
import{modelForecast,buildAnalysis}from'../server/analysis';
import{eloProbability,updateRatings,playerStats,playerKey,modelMetrics,fitCalibration,calibratedProbability,type Rating}from'../src/domain/player-model';
import{isUpcomingOrLive,type FeedMatch}from'../src/shared/board';
import artifact from'../models/elo-v1.json';
const now=Date.parse('2026-11-04T12:00:00Z');
const raw={fixture_id:'test',sport:'table_tennis',home:'Test A',away:'Test B',league:'Synthetic league',status:'finished',finished_at:'2026-11-03T12:00:00Z',updated_at:'2026-11-03T12:02:00Z',final_score:'11-8,11-7,11-9',periods:[{name:'Set 1',score:'11-8'},{name:'Set 2',score:'11-7'},{name:'Set 3',score:'11-9'}]};
describe('real-data guards and interpretable model (synthetic fixtures)',()=>{
 it('excludes finished, overdue, unknown and stale-live events from the board',()=>{
  const m:FeedMatch={id:'t',sport:'table_tennis',home:'A',away:'B',league:'T',in_play:false,kickoff_utc:new Date(now+1000).toISOString(),quotes:[]};
  expect(isUpcomingOrLive(m,now)).toBe(true);expect(isUpcomingOrLive({...m,kickoff_utc:new Date(now-1).toISOString()},now)).toBe(false);
  expect(isUpcomingOrLive({...m,kickoff_utc:undefined},now)).toBe(false);expect(isUpcomingOrLive({...m,in_play:true,polled_at:new Date(now-61000).toISOString()},now)).toBe(false);
  expect(isUpcomingOrLive({...m,in_play:true,polled_at:new Date(now).toISOString()},now)).toBe(true);
 });
 it('accepts only complete and coherent table tennis results with known availability',()=>{
  const r=parseResult(raw,now)!;expect(r.homeWon).toBe(true);expect(r.availableAt).toBe('2026-11-03T12:02:00.000Z');
  for(const bad of [{...raw,status:'unknown'},{...raw,final_score:'3-2'},{...raw,updated_at:'2026-11-05T00:00:00Z'},{...raw,periods:[{name:'Set 1',score:'11-10'}]}])expect(parseResult(bad,now)).toBeNull();
 });
 it('calculates player statistics and does not merge names across competitions',()=>{
  const r=parseResult(raw,now)!;const stats=playerStats([r,{...r,id:'other',league:'Other league'}],raw.league,raw.home);
  expect(stats).toMatchObject({matches:1,wins:1,losses:0,setsFor:3,setsAgainst:0,pointsFor:33,pointsAgainst:24,winRate:1});
  expect(playerStats([r],raw.league,'Missing').winRate).toBeNull();
 });
 it('updates Elo deterministically and computes proper scoring rules',()=>{
  const ratings:Record<string,Rating>={};updateRatings(ratings,parseResult(raw,now)!);
  expect(ratings[playerKey(raw.league,raw.home)]).toEqual({rating:1510,count:1});expect(eloProbability(1500,1500)).toBe(.5);
  expect(modelMetrics([{p:.5,y:1},{p:.5,y:0}]).brier).toBe(.25);expect(modelMetrics([]).brier).toBeNull();
  const c=fitCalibration([{p:.8,y:0},{p:.8,y:1}]);expect(calibratedProbability(.8,c.a,c.b)).toBeLessThan(.8);
 });
 it('does not enable the failed actual holdout or fabricate a forecast for live games',()=>{
  expect(artifact.validated).toBe(false);expect(artifact.validation.n).toBe(118);expect(artifact.validation.brier).toBeGreaterThan(.25);
  const m:FeedMatch={id:'future',sport:'table_tennis',home:raw.home,away:raw.away,league:raw.league,in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),quotes:[]};
  expect(modelForecast(m,now).forecast).toBeNull();expect(modelForecast({...m,in_play:true},now).forecast).toBeNull();
  const report=buildAnalysis(m,{results:[parseResult(raw,now)!],checkedAt:new Date(now).toISOString(),source:'postgres',rejected:0,from:raw.finished_at,to:raw.finished_at},now);
  expect(report.home.matches).toBe(1);expect(report.h2h.homeWins).toBe(1);expect(report.forecast).toBeNull();
 });
 it('requires validated competition, sample, price freshness and a prudent bound',()=>{
  const key=(name:string)=>createHash('sha256').update(playerKey(raw.league,name)).digest('hex');
  const m:FeedMatch={id:'future',sport:'table_tennis',home:raw.home,away:raw.away,league:raw.league,in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),group_status:{'920000':{polled_at:new Date(now).toISOString()}},quotes:[raw.home,raw.away].map((name,i)=>({fixture_id:'future',group_id:'920000',sel_id:String(i),side:name,line:'To Win',odds_dec:i?4:1.4,ts:new Date(now).toISOString()}))};
  const model={version:'synthetic',validated:true,generatedAt:new Date(now-1000).toISOString(),trainingCutoff:new Date(now-10000).toISOString(),calibration:{a:1,b:0},ratings:{[key(raw.home)]:{rating:1750,count:200},[key(raw.away)]:{rating:1450,count:200}},leagues:{[raw.league]:{eligible:true,n:200,brier:.2,logLoss:.6,ece:.02}}};
  expect(modelForecast(m,now,model).forecast?.selection).toBe(raw.home);
  expect(modelForecast({...m,group_status:undefined},now,model).forecast).toBeNull();
  expect(modelForecast(m,now,{...model,validated:false}).forecast).toBeNull();
 });
});
