import {describe,expect,it} from 'vitest';
import {asOfWindow,withinWindow} from '../server/as-of-window';
import {scoreSignals} from '../server/score-signals';
import {ensembleSignals} from '../server/multi-model';
import model from '../models/score-runtime-v1.json';
import ensembleModel from '../models/multi-research-v1.json';
import type {MatchResult} from '../src/domain/player-model';
import type {ResultsArchive} from '../server/results';
import type {FeedMatch} from '../src/shared/board';
const time=Math.max(Date.parse(model.generatedAt),Date.parse(ensembleModel.generatedAt))+60000;
const iso=(n:number)=>new Date(n).toISOString();
const result=(id:string,at:number,homeWon:boolean):MatchResult=>({
 id,home:'A',away:'B',league:'AsOfTest',availableAt:iso(at),finishedAt:iso(at-1000),homeWon,
 sets:homeWon?[[11,8],[11,7],[11,6]]:[[8,11],[7,11],[6,11]]
});
const results=[...Array.from({length:40},(_,i)=>result('history-'+i,time-86400000-i*60000,i%4!==0)),result('just-available',time+1000,false)];
const archive:ResultsArchive={results,source:'postgres',checkedAt:iso(time),from:null,to:null,rejected:0};
const match:FeedMatch={id:'future',home:'A',away:'B',league:'AsOfTest',sport:'table_tennis',in_play:false,kickoff_utc:iso(time+3600000),group_status:{'920000':{polled_at:iso(time)}},quotes:['A','B'].map((side,i)=>({fixture_id:'future',group_id:'920000',market_id:'920000',sel_id:String(i),side,line:'To Win',odds_dec:2,ts:iso(time)}))};
describe('as-of feature availability',()=>{
 it('excludes an outcome at its availability instant and invalidates the cache on either side of the boundary',()=>{
  const before=asOfWindow(results,time),equal=asOfWindow(results,time+1000),after=asOfWindow(results,time+1001);
  expect(before.eligible).toHaveLength(40);expect(equal.eligible).toHaveLength(40);expect(after.eligible).toHaveLength(41);
  expect(withinWindow(before,time+1000)).toBe(true);
  expect(withinWindow(before,time+1001)).toBe(false);
  expect(withinWindow(after,time)).toBe(false);
  expect(()=>asOfWindow(results,NaN)).toThrow('INVALID_PREDICTION_CUTOFF');
 });
 it('does not reuse future results across repeated winner forecasts using the same archive object',()=>{
  const atStart=scoreSignals(match,archive,time);
  const atLate=scoreSignals(match,archive,time+2000);
  const backToStart=scoreSignals(match,archive,time);
  expect(atStart).toHaveLength(2);
  expect(atLate).toHaveLength(2);
  expect(atLate[0].sampleSize).toBe(atStart[0].sampleSize+1);
  expect(atLate[0].featuresAvailableAt).toBe(iso(time+1000));
  expect(backToStart).toEqual(atStart);
 });
 it('does not reuse future results across repeated ensemble forecasts',()=>{
  const initial=ensembleSignals(match,archive,time);
  const later=ensembleSignals(match,archive,time+2000);
  const replay=ensembleSignals(match,archive,time);
  expect(initial).toHaveLength(2);expect(later).toHaveLength(2);
  expect(later[0].sampleSize).toBe(initial[0].sampleSize+1);
  expect(replay).toEqual(initial);
 });
});
