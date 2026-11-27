import {describe,expect,it} from 'vitest';
import {BlindStudy,blindHistory,blindSummary,buildElo,freezeWinner,marketBlend25,settleObserved,weeklyClosingOrder,weeklyScanOverdue} from '../server/blind-study';
import {disagreementStartAt} from '../src/domain/underdog-study';
import type {FeedMatch,FeedQuote} from '../src/shared/board';

const now=Date.parse('2026-11-21T18:00:00Z');
const iso=(time:number)=>new Date(time).toISOString();
const m:FeedMatch<'tennis'>={sport:'tennis',id:'1',home:'A',away:'B',league:'ATP Test',in_play:false,
  kickoff_utc:iso(now+600_000),quotes:[],group_status:{83:{polled_at:iso(now)}}};
const quote:FeedQuote={fixture_id:'1',group_id:'83',sel_id:'a',label:'A',odds_dec:2.2,ts:iso(now-1)};
const opponent={...quote,sel_id:'b',label:'B',odds_dec:1.7};
const result={id:'1',home:'A',away:'B',league:'ATP Test',homeWon:true,availableAt:iso(now+800_000),finishedAt:iso(now+700_000)};

describe('winner observation frozen before outcome',()=>{
  it('alternates recent priced fixtures with the older queue without using outcomes or odds size',()=>{
    const f=(id:string,seenAt:number,both=true)=>({id,parameters:{forecast:{seenAt,prices:{home:{odds:1.6,quoteAt:''},away:both?{odds:2.5,quoteAt:''}:null}}}});
    const rows=[f('old-1',disagreementStartAt-2),f('old-2',disagreementStartAt-1),
      f('unpriced',disagreementStartAt,false),f('new-1',disagreementStartAt+1),f('new-2',disagreementStartAt+2)];
    expect(weeklyClosingOrder(rows).map(r=>r.id)).toEqual(['new-1','old-1','new-2','old-2','unpriced']);
    expect(weeklyClosingOrder(rows.slice(0,2))).toEqual(rows.slice(0,2));
  });
  it('only retries after a missing heartbeat or a 45 minute gap',()=>{
    expect(weeklyScanOverdue(now,now+44*60_000)).toBe(false);
    expect(weeklyScanOverdue(now,now+45*60_000)).toBe(true);
    expect(weeklyScanOverdue(0,now)).toBe(true);
  });
  it('starts continuous collection only in production after enrollment in the pilot ends',async()=>{
    const env={VERCEL_ENV:'production',APP_BLIND_STUDY_ENABLED:'1'};
    await expect(new BlindStudy(env,()=>Date.parse('2026-12-01T15:59:59Z')).runHistory()).resolves.toEqual({status:'window_closed'});
    await expect(new BlindStudy({...env,VERCEL_ENV:'preview'},()=>Date.parse('2027-01-01')).runHistory()).resolves.toEqual({status:'disabled'});
  });
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
    expect(settleObserved(forecast,{...result,home:'B',away:'A',homeWon:true,sets:[[11,8],[12,10],[11,9]]},now+1,now+900_000))
      .toMatchObject({winner:'away',sets:[[8,11],[10,12],[9,11]]});
    expect(settleObserved(forecast,result,now+700_001,now+900_000)?.invalid).toBe(true);
    const outcome=settleObserved(forecast,result,now+1,now+900_000)!;
    const stored={id:'case',created_at:iso(now+1),parameters:{study:'blind-winner-v1',userId:'owner',forecast,hash:'test',attempts:0,lastAttempt:0,outcome}};
    expect(blindSummary([stored],'tennis')).toMatchObject({exact:1,verifiedExact:0,paired:0});
    expect(blindSummary([{...stored,parameters:{...stored.parameters,outcome:{...outcome,actualGuard:now+500_000}}}],'tennis'))
      .toMatchObject({exact:1,verifiedExact:1,paired:1});
  });
  it('compares three methods on the same verified matches across UTC weeks',()=>{
    const at=Date.parse('2026-11-29T23:55:00Z');
    const forecast={sport:'table_tennis' as const,id:'verified',home:'A',away:'B',league:'Test',model:'score',
      homeProbability:.75,peerHomeProbability:.25,marketBlend25HomeProbability:.4,selection:'home' as const,seenAt:at,scheduledAt:at+600_000,
      prices:{home:{odds:3,quoteAt:iso(at)},away:{odds:1.5,quoteAt:iso(at)}}};
    const outcome={winner:'home' as const,finishedAt:iso(at+1_800_000),availableAt:iso(at+2_000_000),actualGuard:at+600_000,
      invalid:false,sets:[[11,8],[11,7],[11,9]] as [number,number][]};
    const stored={id:'case',created_at:iso(at+1),parameters:{study:'blind-winner-v1',userId:'owner',forecast,hash:'test',attempts:0,lastAttempt:0,outcome}};
    const reported={...stored,id:'reported',parameters:{...stored.parameters,forecast:{...forecast,id:'reported'},outcome:{...outcome,actualGuard:null}}};
    const invalid={...stored,id:'invalid',parameters:{...stored.parameters,forecast:{...forecast,id:'invalid'},outcome:{...outcome,invalid:true}}};
    const pending={...stored,id:'pending',parameters:{...stored.parameters,forecast:{...forecast,id:'pending',seenAt:at+600_000},outcome:null}};
    const history=blindHistory([stored,reported,invalid,pending],at+2_000_000);
    expect(history.weeks[0]).toMatchObject({from:'2026-11-30T00:00:00.000Z',pending:1,paired:0});
    expect(history.weeks[1]).toMatchObject({recorded:3,exact:2,verifiedExact:1,invalid:1,paired:1,
      peer:{count:1,modelBrier:.0625,eloBrier:.5625,marketBrier:expect.closeTo(4/9)},
      candidate:{count:1,brier:.36,marketBrier:expect.closeTo(4/9)}});
    expect(history.recent).toHaveLength(2);
    expect(history.recent.find(row=>row.id==='verified')).toMatchObject({homeOdds:3,status:'verified',sets:outcome.sets});
    const later=Date.parse('2027-04-01T12:00:00Z');
    const latest=blindHistory([stored],later);
    expect(latest.weeks).toHaveLength(12);
    expect(latest.recent).toHaveLength(0);
    const previous=blindHistory([stored],later,Date.parse(latest.older!));
    expect(previous.recent).toHaveLength(1);
    expect(previous.newer).toBe(latest.weeks[0].from);
  });
  it('freezes the market correction using only both price sides and both prior forecasts',()=>{
    const prices={home:{odds:3,quoteAt:iso(now)},away:{odds:1.5,quoteAt:iso(now)}};
    const forecast={homeProbability:.65,peerHomeProbability:.55,prices};
    const blended=marketBlend25(forecast)!;
    expect(blended).toBeGreaterThan(1/3);
    expect(blended).toBeLessThan(.6);
    expect(marketBlend25({homeProbability:.35,peerHomeProbability:.45,prices:{home:prices.away,away:prices.home}})).toBeCloseTo(1-blended);
    expect(marketBlend25({...forecast,peerHomeProbability:undefined})).toBeUndefined();
    expect(marketBlend25({...forecast,prices:{...prices,away:null}})).toBeUndefined();
  });
});
