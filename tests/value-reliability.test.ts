import {describe,expect,it} from 'vitest';
import {fairMarketProbability,guardedValue} from '../src/shared/value-filter';
import {valueReliability,valuePolicyStartedAt} from '../src/domain/value-reliability';
import type {WinnerCase} from '../src/domain/winner-comparison';

describe('fixed value guard',()=>{
  it('requires agreement on the favorite and a positive residual EV',()=>{
    expect(fairMarketProbability(1.50,3)).toBeCloseTo(2/3);
    expect(fairMarketProbability(2.30,2.30)).toBeNull();
    expect(guardedValue(.55,.48,3,1.40)).toBeNull();
    expect(guardedValue(.68,.66,1.53,2.75)).toBeNull();
    expect(guardedValue(.82,.75,1.50,2.7)?.guardedEv).toBeGreaterThan(0);
  });

  it('keeps high nominal EV, matched calibration and the following period separate',()=>{
    const at=Date.parse(valuePolicyStartedAt);
    const make=(id:string,when:number,homeOdds:number,awayOdds:number,p:number,y:number,status:WinnerCase['outcome']['status']='settled'):WinnerCase=>{
      const timestamp=new Date(when).toISOString();
      return {forecastHash:'fixture',forecast:{id,userId:'fixture',studyId:'fixture',protocolHash:'fixture',sourceHash:'fixture',
        at:when,kickoff:when+600_000,homeOdds,awayOdds,homeQuoteAt:timestamp,awayQuoteAt:timestamp,readAt:timestamp,
        featuresAvailable:when-1,sampleSize:200,x:[],leagueProbability:.5,bookmakerProbability:.5,
        probabilities:{'full-logistic':p}},outcome:{status,y}};
    };
    const prior=make('a',at-1,3.1,1.45,.55,0);
    const fresh=make('b',at,1.50,2.7,.87,1);
    const duplicate=make('d',at,1.50,2.7,.88,1);
    const pending=make('p',at,1.50,2.7,.88,1,'pending');
    const report=valueReliability([prior,fresh,duplicate,duplicate,pending],at+3);
    expect(report.historical.high).toMatchObject({n:1,exact:0,wrong:1});
    expect(report.historical.guarded.n).toBe(0);
    expect(report.forward.n).toBe(1);
    expect(report.forward.guarded).toMatchObject({n:1,exact:1});
    expect(report.verifiedForUse).toBe(false);
  });
});
