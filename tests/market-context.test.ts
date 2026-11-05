import {describe,it,expect} from 'vitest';
import {MarketContext,marketRows,marketOutcomes,MARKET_TARGETS} from '../src/domain/market-context';
import type {MatchResult} from '../src/domain/player-model';

const game=(id:string,at:number,sets:[number,number][]= [[11,5],[11,5],[11,5]]):MatchResult=>({id,home:'A',away:'B',league:'Test',finishedAt:new Date(at).toISOString(),availableAt:new Date(at).toISOString(),sets,homeWon:sets.filter(s=>s[0]>s[1]).length>sets.filter(s=>s[0]<s[1]).length});
describe('market-specific research features',()=>{
  it('settles each exact half-point line and reverses handicap orientation',()=>{
    const m=game('x',1000,[[11,9],[8,11],[11,9],[9,11],[11,8]]);
    const y=marketOutcomes(m),z=marketOutcomes(m,true);
    expect(y).toHaveLength(MARKET_TARGETS.length);
    expect(y.slice(0,8)).toEqual([1,1,1,1,1,1,1,1]); // five sets, 98 points
    expect(y.slice(8)).toEqual([0,1,0,1,0,1]); // +1 set, +2 points
    expect(z[0]).toBe(1-y[0]);expect(z[1]).toBe(1-y[1]);
    for(const [a,b] of [[8,9],[10,11],[12,13]]){expect(z[a]).toBe(1-y[b]);expect(z[b]).toBe(1-y[a]);}
    expect(z.slice(2,8)).toEqual(y.slice(2,8));
    const straight=marketOutcomes(game('straight',1000));
    expect(straight[3]).toBe(0);expect(straight[4]).toBe(0);expect(straight[8]).toBe(1);
  });
  it('cannot use simultaneous or future available results or the target label',()=>{
    const at=100000,old=game('old',1000),target=game('target',at+20000),future=game('future',at,[[5,11],[5,11],[5,11]]);
    const rows=marketRows([old,future,target],[{id:target.id,at},{id:target.id,at}],1);
    const changed=marketRows([old,{...target,sets:[[5,11],[5,11],[5,11]],homeWon:false}],[{id:target.id,at}],1);
    expect(rows).toHaveLength(1);expect(rows[0].featuresAvailable).toBe(1000);
    expect(rows[0].x).toEqual(changed[0].x);expect(rows[0].baseline).toEqual(changed[0].baseline);
    expect(rows[0].y).not.toEqual(changed[0].y);
    expect(marketRows([old,target],[{id:target.id,at}])).toHaveLength(0);
  });
  it('preserves nested probabilities for totals and handicaps in the EB family',()=>{
    const context=new MarketContext();
    for(let i=0;i<35;i++)context.update(game(String(i),1000+i*1000,i%2?[[11,9],[8,11],[11,9],[9,11],[11,8]]:[[5,11],[5,11],[5,11]]));
    const f=context.features({league:'Test',home:'A',away:'B'},100000)!;
    expect(f.x).toHaveLength(63);expect(f.x.every(Number.isFinite)).toBe(true);
    for(const p of [f.baseline,f.eb]){
      expect(p.every(v=>v>=0&&v<=1)).toBe(true);
      expect(p[3]).toBeGreaterThanOrEqual(p[4]);expect(p[5]).toBeGreaterThanOrEqual(p[6]);expect(p[6]).toBeGreaterThanOrEqual(p[7]);
      expect(p[13]).toBeGreaterThanOrEqual(p[11]);expect(p[11]).toBeGreaterThanOrEqual(p[10]);expect(p[10]).toBeGreaterThanOrEqual(p[12]);
      expect(p[9]).toBeGreaterThanOrEqual(p[8]);
    }
    expect(()=>context.features({league:'Test',home:'A',away:'B'},35000)).toThrow('MARKET_CONTEXT_FUTURE_DATA');
    expect(()=>context.update(game('unordered',1000))).toThrow('MARKET_CONTEXT_ORDER');
  });
  it('keeps previous-day features fixed when only new target labels change',()=>{
    const context=new MarketContext();for(let i=0;i<30;i++)context.update(game(String(i),1000+i*1000));
    const target=game('new',200000),before=context.features(target,100000)!;
    marketOutcomes({...target,homeWon:false,sets:[[5,11],[5,11],[5,11]]});
    expect(context.features(target,100000)).toEqual(before);
    expect(before.available).toBe(30000);
  });
});
