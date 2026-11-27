import { describe,expect,it } from 'vitest';
import {evaluateSport} from '../server/sport-training';

const time=Date.parse('2026-11-21T00:00:00Z');
const hours=3_600_000;
const earlier=(age:number)=>new Date(time-age*hours).toISOString();
const first={fixture_id:'f1',sport:'badminton',home:'A',away:'B',league:'League',status:'finished',final_score:'21-17,30-29',
 finished_at:earlier(5),updated_at:earlier(4)};

describe('sport-specific winner studies',()=>{
 it('counts completed singles, checks real times and excludes conflicting IDs',()=>{
  const report=evaluateSport('badminton',{source:'postgres',results:[
   first,{...first,fixture_id:'f2',kickoff_utc:earlier(8)},
   {...first,fixture_id:'f3',kickoff_utc:earlier(3),updated_at:earlier(8)},
   {...first,fixture_id:'f4',league:'League Doubles'},
   {...first,fixture_id:'f5',final_score:'20-17,21-18'},
   {...first,fixture_id:'f6',status:'unknown'},
   {...first,fixture_id:'f7',final_score:'2-1'},{...first,fixture_id:'f7',final_score:'0-2'},
  ]},time);
  expect(report).toMatchObject({raw:8,complete:3,withScheduledStart:1,withPublication:2,selected:null});
 });

 it('uses only confirmed binary combat outcomes even when a score looks decisive',()=>{
  const row={...first,sport:'mma',final_score:'1-0'};
  const report=evaluateSport('mma',{source:'postgres',results:[
   row,{...row,fixture_id:'2',fight:{result:'draw'}},{...row,fixture_id:'3',fight:{result:'home'}},
   {...row,fixture_id:'4',final_score:'0-1',fight:{result:'home'}},
  ]},time);
  expect(report.complete).toBe(1);
 });

 it('trains on the early window and reproduces performance on a later test',()=>{
  const results=Array.from({length:1000},(_,index)=>{
   const at=(202-Math.floor(index/5))*24+index%5;
   return {...first,fixture_id:String(index),sport:'snooker',home:'A'+index%5,away:'B'+index%5,
    final_score:index%5<3?'4-2':'1-4',finished_at:earlier(at),updated_at:earlier(at-.5),kickoff_utc:earlier(at+2)};
  });
  const report=evaluateSport('snooker',{source:'postgres',results},time);
  expect(report.train).toBeGreaterThan(100);
  expect(report.calibration).toBeGreaterThan(40);
  expect(report.test).toBeGreaterThan(40);
  expect(report.selected).toBeTruthy();
  expect(report.candidates).toHaveLength(3);
  expect(report.candidates[0].test.n).toBe(report.test);
  expect(report.candidates[0].test.brier).toBeLessThan(.25);
  expect(evaluateSport('snooker',{source:'memory',results},time).candidates).toEqual([]);
 });
});
