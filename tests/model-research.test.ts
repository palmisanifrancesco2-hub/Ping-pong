import {describe,it,expect} from 'vitest';
import {ResearchRatings,researchRows,chooseCandidate,dayClusterDifference,wilsonInterval,candidates} from '../src/domain/model-research';
import type {MatchResult} from '../src/domain/player-model';
const match=(id:string,availableAt:string,homeWon=true):MatchResult=>({id,home:'A',away:'B',league:'TT',homeWon,availableAt,finishedAt:availableAt,sets:homeWon?[[11,8],[11,8],[11,8]]:[[8,11],[8,11],[8,11]]});
describe('research protects chronological evaluation',()=>{
 it('excludes labels available at or after prediction time',()=>{
 const results=[match('old','2026-10-01T09:00:00Z'),match('same','2026-10-01T10:00:00Z',false),match('future','2026-10-01T11:00:00Z',false),match('target','2026-10-01T12:00:00Z')];
 const starts=[{id:'target',at:Date.parse('2026-10-01T10:00:00Z')}];
 const actual=researchRows(results,starts,1);
 const withoutFuture=researchRows([results[0],results[3]],starts,1);
 expect(actual).toEqual(withoutFuture);expect(actual).toHaveLength(1);
 });
 it('does not train on target outcome and skips duplicate targets',()=>{
 const old=match('old','2026-10-01T09:00:00Z'),a=match('target','2026-10-01T12:00:00Z');
 const start={id:'target',at:Date.parse('2026-10-01T10:00:00Z')};
 const x=researchRows([old,a],[start,start],1),y=researchRows([old,{...a,homeWon:false}],[start],1);
 expect(x).toHaveLength(1);expect(x[0].p).toEqual(y[0].p);
 });
 it('rejects insufficient history and isolates leagues',()=>{
 const ratings=new ResearchRatings();ratings.update(match('a','2026-10-01T09:00:00Z'));
 expect(ratings.predict({league:'TT',home:'A',away:'B'})).toBeNull();
 expect(ratings.predict({league:'other',home:'A',away:'B'},1)).toBeNull();
 });
 it('all models are symmetric in player order',()=>{
 const ratings=new ResearchRatings();for(let i=0;i<30;i++)ratings.update(match(String(i),'2026-10-01T09:00:00Z',i%3!==0));
 const a=ratings.predict({league:'TT',home:'A',away:'B'})!,b=ratings.predict({league:'TT',home:'B',away:'A'})!;
 for(const name of candidates){expect(a[name]+b[name]).toBeCloseTo(1,12);expect(a[name]).toBeGreaterThan(0);expect(a[name]).toBeLessThan(1);}
 });
 it('chooses by supplied development rows only',()=>{
 const p={elo10:.9,elo20:.8,elo40:.7,elo80:.6,form20:.5,'elo40-form20':.6};
 expect(chooseCandidate([{id:'a',at:1,available:2,league:'TT',y:1,p}])).toBe('elo10');
 expect(()=>chooseCandidate([])).toThrow('NO_SELECTION_DATA');
 });
 it('does not invent uncertainty with only one daily cluster',()=>{
 expect(dayClusterDifference([{at:0,p:.8,y:1,baseline:.5}]).upper95).toBeNull();
 });
 it('uses a paired loss difference with negative meaning improvement',()=>{
 const d=dayClusterDifference([0,86400000,172800000].map(at=>({at,p:.8,y:1,baseline:.5})));
 expect(d.days).toBe(3);expect(d.mean).toBeCloseTo(-.21);expect(d.upper95).toBeCloseTo(-.21);
 });
 it('widens descriptive win-rate intervals on small samples',()=>{
 const small=wilsonInterval(5,10)!,big=wilsonInterval(50,100)!;
 expect(small.upper-small.lower).toBeGreaterThan(big.upper-big.lower);
 expect(wilsonInterval(0,0)).toBeNull();expect(wilsonInterval(11,10)).toBeNull();
 expect(wilsonInterval(0,10)!.lower).toBeCloseTo(0);expect(wilsonInterval(10,10)!.upper).toBeCloseTo(1);
 });
});

import {verifiedStart,prematchBenchmark} from '../src/domain/research-source';
describe('source benchmark timestamp guards',()=>{
 const target=match('target','2026-10-01T12:30:00Z');
 const at=Date.parse('2026-10-01T11:59:00Z');
 const payload=()=>({closed:true,fixture_id:'target',kickoff_known:true,kickoff_estimated:false,kickoff_utc:'2026-10-01T12:00:00Z',pre_close_basis:'kickoff',selections:['A','B'].map(side=>({side,group_id:'920000',market_id:'920000',line:'To Win',pre_close:{side,market_id:'920000',odds_dec:2,suspended:false,ts:'2026-10-01T11:58:00Z'}}))});
 it('accepts exact identities and strips margin from a coherent pair',()=>{expect(verifiedStart(payload(),target)).toBe(at);expect(prematchBenchmark(payload(),target,at)?.probability).toBe(.5);});
 it('rejects estimated starts and substring player matches',()=>{expect(verifiedStart({...payload(),kickoff_estimated:true},target)).toBeNull();expect(verifiedStart(payload(),{...target,home:'AA'})).toBeNull();});
 it('rejects future and stale closing quote observations',()=>{for(const time of ['2026-10-01T12:00:01Z','2026-10-01T10:00:00Z']){const p=payload();p.selections[0].pre_close.ts=time;expect(prematchBenchmark(p,target,at)).toBeNull();}});
 it('rejects incomplete, suspended, or duplicated price pairs',()=>{const p=payload();p.selections[0].pre_close.suspended=true;expect(prematchBenchmark(p,target,at)).toBeNull();expect(prematchBenchmark({...payload(),selections:[payload().selections[0]]},target,at)).toBeNull();expect(prematchBenchmark({...payload(),selections:[payload().selections[0],payload().selections[0]]},target,at)).toBeNull();});
});
