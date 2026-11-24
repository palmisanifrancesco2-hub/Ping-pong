import {describe,expect,it} from 'vitest';
import {fairMarketProbability,guardedValue} from '../src/shared/value-filter';
import {valueReliability,valuePolicyStartedAt} from '../src/domain/value-reliability';
import type {WinnerCase} from '../src/domain/winner-comparison';

describe('fixed value guard',()=>{
  it('accepts either side and requires a positive residual EV',()=>{
    expect(fairMarketProbability(1.50,3)).toBeCloseTo(2/3);
    expect(fairMarketProbability(2.30,2.30)).toBeNull();
    expect(guardedValue(.47,.40,3.2,1.4)?.guardedEv).toBeGreaterThan(0);
    expect(guardedValue(.43,.314,3.2,1.34)).toBeNull();
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
    fresh.outcome.closing={homeOdds:1.35,awayOdds:3.5,homeAt:at+300_000,awayAt:at+301_000,probability:3.5/4.85};
    const duplicate=make('d',at,1.50,2.7,.88,1);
    const pending=make('p',at,1.50,2.7,.88,1,'pending');
    const report=valueReliability([prior,fresh,duplicate,duplicate,pending],at+3);
    expect(report.historical.high).toMatchObject({n:1,exact:0,wrong:1});
    expect(report.historical.guarded).toMatchObject({n:1,wrong:1,roi:{mean:-1}});
    expect(report.historical.guardedUnderdogs).toMatchObject({n:1,wrong:1});
    expect(report.forward.n).toBe(1);
    expect(report.forward.guarded).toMatchObject({n:1,exact:1,roi:{mean:.5}});
    expect(report.forward.guardedUnderdogs.n).toBe(0);
    expect(report.forward.closingValue).toMatchObject({n:1,positive:1,shortened:1});
    expect(report.forward.closingValue.mean).toBeCloseTo(1.5*3.5/4.85-1);
    expect(report.verifiedForUse).toBe(false);
  });
});
