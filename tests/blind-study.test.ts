import {describe,expect,it} from 'vitest';
import {blindSummary,buildElo,freezeWinner,settleObserved} from '../server/blind-study';
import type {FeedMatch,FeedQuote} from '../src/shared/board';

const now=Date.parse('2026-11-21T18:00:00Z');
const iso=(time:number)=>new Date(time).toISOString();
const m:FeedMatch<'tennis'>={sport:'tennis',id:'1',home:'A',away:'B',league:'ATP Test',in_play:false,
  kickoff_utc:iso(now+600_000),quotes:[],group_status:{83:{polled_at:iso(now)}}};
const quote:FeedQuote={fixture_id:'1',group_id:'83',sel_id:'a',label:'A',odds_dec:2.2,ts:iso(now-1)};
const opponent={...quote,sel_id:'b',label:'B',odds_dec:1.7};
const result={id:'1',home:'A',away:'B',league:'ATP Test',homeWon:true,availableAt:iso(now+800_000),finishedAt:iso(now+700_000)};

describe('winner observation frozen before outcome',()=>{
  it('preserves prediction and optional coherent fresh price, independently of value',()=>{
    expect(freezeWinner(m,now,.6,'test',[quote,opponent])).toMatchObject({selection:'home',homeProbability:.6,prices:{home:{odds:2.2},away:{odds:1.7}}});
    expect(freezeWinner(m,now,.4,'test',[quote])?.prices).toEqual({home:{odds:2.2,quoteAt:quote.ts},away:null});
    expect(freezeWinner(m,now,.5,'test',[])?.selection).toBeNull();
    expect(freezeWinner(m,now,.6,'test',[{...quote,ts:iso(now+1)}])?.prices).toBeNull();
    expect(freezeWinner({...m,in_play:true},now,.6,'test',[])).toBeUndefined();
  });

  it('uses only published prior results for both competitors in the same competition',()=>{
    const histories=Array.from({length:4},(_,i)=>({...result,id:String(i+20),finishedAt:iso(now-2000-i),availableAt:iso(now-1000-i)}));
    expect(buildElo(histories,now)(m)).toBeGreaterThan(.5);
    expect(buildElo(histories.slice(1),now)(m)).toBeUndefined();
    expect(buildElo([...histories.slice(1),{...histories[0],availableAt:iso(now)}],now)(m)).toBeUndefined();
    expect(buildElo(histories,now)({...m,league:'Different'})).toBeUndefined();
  });

  it('settles only a matching available result and separates verified observations from reported outcomes',()=>{
    const forecast=freezeWinner(m,now,.65,'test',[quote,opponent])!;
    expect(settleObserved(forecast,result,now+1,now+100)).toBeNull();
    expect(settleObserved(forecast,{...result,id:'2'},now+1,now+900_000)).toBeNull();
    expect(settleObserved(forecast,{...result,home:'B',away:'A',homeWon:true},now+1,now+900_000)?.winner).toBe('away');
    expect(settleObserved(forecast,result,now+700_001,now+900_000)?.invalid).toBe(true);
    const outcome=settleObserved(forecast,result,now+1,now+900_000)!;
    const stored={id:'case',created_at:iso(now+1),parameters:{study:'blind-winner-v1',userId:'owner',forecast,hash:'test',attempts:0,lastAttempt:0,outcome}};
    expect(blindSummary([stored],'tennis')).toMatchObject({exact:1,verifiedExact:0,paired:0});
    expect(blindSummary([{...stored,parameters:{...stored.parameters,outcome:{...outcome,actualGuard:now+500_000}}}],'tennis'))
      .toMatchObject({exact:1,verifiedExact:1,paired:1});
  });
});
