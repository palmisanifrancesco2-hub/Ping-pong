import {describe,it,expect} from 'vitest';
import {ScoreFeatures,featureRows,fitScore,predictScore,featureGroups} from '../src/domain/score-model';
import type {MatchResult} from '../src/domain/player-model';
const match=(id:string,at:string,homeWon=true):MatchResult=>({id,league:'Test',home:'A',away:'B',finishedAt:at,availableAt:at,homeWon,sets:homeWon?[[11,5],[11,5],[11,5]]:[[5,11],[5,11],[5,11]]});
describe('score-based statistical model',()=>{
 it('uses points, sets, wins, H2H and exposure, with opposite signs after player reversal',()=>{
 const engine=new ScoreFeatures();for(let i=0;i<30;i++)engine.update(match(String(i),new Date(Date.UTC(2026,9,1,i)).toISOString(),i%4!==0));
 const at=Date.UTC(2026,9,3),a=engine.features({league:'Test',home:'A',away:'B'},at)!,b=engine.features({league:'Test',home:'B',away:'A'},at)!;
 expect(a.x).toHaveLength(8);for(let i=0;i<8;i++)expect(a.x[i]).toBeCloseTo(-b.x[i],12);
 expect(a.x[1]).toBeGreaterThan(0);expect(a.x[2]).toBeGreaterThan(0);expect(a.x[5]).toBeGreaterThan(0);
 expect(engine.features({league:'Other',home:'A',away:'B'},at)).toBeNull();
 });
 it('does not learn future or simultaneous results or the target outcome',()=>{
 const at=Date.parse('2026-10-03T00:00:00Z'),old=match('old','2026-10-01T00:00:00Z'),future=match('future','2026-10-03T00:00:00Z',false),target=match('target','2026-10-03T01:00:00Z');
 const a=featureRows([old,future,target],[{id:'target',at}],1),b=featureRows([old,{...target,homeWon:false}],[{id:'target',at}],1);
 expect(a).toHaveLength(1);expect(a[0].x).toEqual(b[0].x);expect(a[0].elo).toEqual(b[0].elo);
 });
 it('purges duplicate targets and requires minimum player history',()=>{
 const at=Date.parse('2026-10-03T00:00:00Z'),old=match('old','2026-10-01T00:00:00Z'),target=match('target','2026-10-03T01:00:00Z');
 const starts=[{id:'target',at},{id:'target',at}];expect(featureRows([old,target],starts)).toHaveLength(0);expect(featureRows([old,target],starts,1)).toHaveLength(1);
 });
 it('fits a deterministic regularized relationship and preserves symmetric predictions',()=>{
 const rows=Array.from({length:80},(_,i)=>({x:[i%2?1:-1,0,0,0,0,0,0,0],y:i%2}));
 const model=fitScore(rows,featureGroups.scores,.01),p=predictScore(model,[1,0,0,0,0,0,0,0]);
 expect(p).toBeGreaterThan(.8);expect(p+predictScore(model,[-1,0,0,0,0,0,0,0])).toBeCloseTo(1,12);
 expect(model).toEqual(fitScore(rows,featureGroups.scores,.01));
 expect(predictScore(model,[1,0,0,0,0,0,0,0],.5)).toBeLessThan(p);
 });
 it('rejects missing and nonfinite data instead of producing a forecast',()=>{
 expect(()=>fitScore([],featureGroups.full,.01)).toThrow('INVALID_TRAINING_DATA');
 expect(()=>predictScore({indices:[0],weights:[1],lambda:.1},[NaN,0,0,0,0,0,0,0])).toThrow('INVALID_FEATURES');
 });
});

import {captureCandidates} from '../src/domain/forward-study';
import type{Board}from '../src/shared/board';
describe('prospective recording',()=>{
 const now=Date.parse('2026-10-03T00:00:00Z');
 const board=():Board=>({provider:'MoviOdds',bookmakerSite:'bet365.com.au',warming:false,checkedAt:new Date(now).toISOString(),serverTime:new Date(now).toISOString(),matches:[{id:'future',league:'Test',home:'A',away:'B',sport:'table_tennis',in_play:false,kickoff_utc:new Date(now+3600000).toISOString(),group_status:{'920000':{polled_at:new Date(now).toISOString()}},quotes:['A','B'].map((side,i)=>({fixture_id:'future',group_id:'920000',market_id:'920000',line:'To Win',side,sel_id:String(i),ts:new Date(now).toISOString(),odds_dec:2,suspended:false}))}]});
 const engine=()=>{const e=new ScoreFeatures();for(let i=0;i<30;i++)e.update(match(String(i),'2026-10-01T00:00:00Z',i%2===0));return e;};
 const model={model:{indices:[0],weights:[1],lambda:.01},temperature:1};
 it('captures future snapshots and excludes live, finished and missing quote pairs',()=>{
 expect(captureCandidates(board(),engine(),new Set(),now,model)).toHaveLength(1);
 expect(captureCandidates(board(),engine(),new Set(['future']),now,model)).toHaveLength(0);
 const live=board();live.matches[0].in_play=true;expect(captureCandidates(live,engine(),new Set(),now,model)).toHaveLength(0);
 const missing=board();missing.matches[0].quotes.pop();expect(captureCandidates(missing,engine(),new Set(),now,model)).toHaveLength(0);
 });
 it('requires a fresh observed board, sufficient lead time and nonfuture quote timestamps',()=>{
 expect(()=>captureCandidates(board(),engine(),new Set(),now+31000,model)).toThrow('BOARD_OBSERVATION_STALE');
 const started=board();started.matches[0].kickoff_utc=new Date(now+1000).toISOString();expect(captureCandidates(started,engine(),new Set(),now,model)).toHaveLength(0);
 const futureQuote=board();futureQuote.matches[0].quotes[0].ts=new Date(now+1000).toISOString();expect(captureCandidates(futureQuote,engine(),new Set(),now,model)).toHaveLength(0);
 });
});
