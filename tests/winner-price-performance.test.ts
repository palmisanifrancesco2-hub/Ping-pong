import {describe, it, expect} from 'vitest';
import {winnerPricePerformance} from '../src/domain/winner-price-performance';
import {winnerProtocol, type WinnerCase} from '../src/domain/winner-comparison';

const now = Date.parse('2026-11-18T12:00:00Z'), DAY = 86400000;
function row(id: string, p: number, y: number, homeOdds: number, awayOdds: number, at = now-3600000): WinnerCase {
  return {forecast:{id, userId:'private-owner', studyId:winnerProtocol.id, protocolHash:'private-hash', sourceHash:'private-source',
    at, kickoff:at+600000, featuresAvailable:at-1000, sampleSize:50, x:Array(63).fill(.1), leagueProbability:.5,
    probabilities:Object.fromEntries(winnerProtocol.candidates.map(k => [k,p])), bookmakerProbability:.5,
    homeOdds, awayOdds, homeQuoteAt:new Date(at).toISOString(), awayQuoteAt:new Date(at).toISOString(), readAt:new Date(at).toISOString()},
    forecastHash:'private-forecast-hash', outcome:{status:'settled', y}};
}
const all = (cases: WinnerCase[]) => winnerPricePerformance(cases, now).windows.find(w => w.key === 'all')!;

describe('prospective original-price performance', () => {
  it('uses the model selected side, computes mean/median and unit arithmetic without real bets', () => {
    const cases=[row('1',.8,1,1.5,3), row('2',.4,0,2.5,2), row('3',.6,0,2.5,1.6), row('4',.2,1,1.4,3)];
    const snapshot=JSON.stringify(cases), report=all(cases), s=report.models[0].policies.all;
    expect(s.correct).toEqual({n:2,mean:1.75,median:1.75});
    expect(s.wrong).toEqual({n:2,mean:2.75,median:2.75});
    expect(s.meanWrongMinusCorrect).toBe(1);expect(s.theoreticalNetUnits).toBe(-.5);
    expect(s.verifiedROI).toBeNull();expect(s.realBets).toBe(false);
    expect(JSON.stringify(cases)).toBe(snapshot);
    const text=JSON.stringify(report);for(const privateValue of ['private-owner','private-source','private-forecast-hash'])expect(text).not.toContain(privateValue);
  });
  it('keeps per-model choices distinct and reconciles filters without a maximum quote', () => {
    const cases=[row('a',.9,1,1.2,4),row('b',.8,1,1.3,3),row('c',.75,0,4/3,2),row('d',.6,0,20,1.1)];
    cases[1].forecast.probabilities[winnerProtocol.candidates[1]]=.2;
    const report=all(cases), s=report.models[0].policies.value;
    expect(s.selected).toBe(2);expect(s.excludedByMinimum).toBe(1);expect(s.excludedByEV).toBe(1);
    expect(s.wrong.mean).toBe(20);
    expect(report.models[1].policies.value.correct.n).toBe(0);
    for(const m of report.models)for(const stats of Object.values(m.policies))expect(stats.selected+stats.undecided+stats.excludedByMinimum+stats.excludedByEV+stats.invalidProbability).toBe(report.eligibleSettled);
  });
  it('retains pending/invalid cases and shows empty groups as unavailable', () => {
    const pending=row('p',.6,1,2,2);pending.outcome={status:'pending'};
    const invalid=row('i',.6,1,2,2);invalid.outcome={status:'invalid',reason:'source revised'};
    const report=all([pending,invalid,row('tie',.5,1,2,2)]), s=report.models[0].policies.value;
    expect(report).toMatchObject({registered:3,settled:1,pending:1,invalid:1,eligibleSettled:1});
    expect(s.undecided).toBe(1);expect(s.selected).toBe(0);expect(s.correct.mean).toBeNull();expect(s.theoreticalNetUnits).toBeNull();
  });
  it('counts corrupt/missing/future quote data instead of fabricating historical prices', () => {
    const future=row('future',.6,1,2,2);future.forecast.homeQuoteAt=new Date(future.forecast.at+1).toISOString();
    const missing=row('missing',.6,1,2,2);missing.forecast.readAt='';
    const bad=row('bad',.6,1,NaN,2);
    const stable=row('stable',.6,1,2,2);stable.forecast.homeQuoteAt=new Date(stable.forecast.at-DAY).toISOString();
    const report=all([future,missing,bad,stable]);
    expect(report).toMatchObject({settled:4,unavailableQuotes:3,eligibleSettled:1});
    expect(report.models[0].policies.all.correct.mean).toBe(2);
  });
  it('uses forecast time for rolling periods and excludes future records explicitly', () => {
    const cases=[row('new',.7,1,2,2,now-DAY+1),row('old',.7,1,2,2,now-8*DAY),row('future',.7,1,2,2,now+1)];
    const report=winnerPricePerformance(cases,now);
    expect(report.invalidOrFutureForecastTimes).toBe(1);
    expect(report.windows.find(w=>w.key==='1')?.registered).toBe(1);
    expect(report.windows.find(w=>w.key==='7')?.registered).toBe(1);
    expect(report.windows.find(w=>w.key==='14')?.registered).toBe(2);
    expect(report.windows.find(w=>w.key==='all')?.registered).toBe(2);
    expect(()=>winnerPricePerformance(cases,NaN)).toThrow('PRICE_PERFORMANCE_INVALID_TIME');
  });
  it('rejects all copies of duplicate events and exposes missing outcomes/probabilities', () => {
    const a=row('duplicate',.6,1,2,2), missing=row('outcome',.6,1,2,2), bad=row('probability',.6,1,2,2);
    missing.outcome={status:'settled'};bad.forecast.probabilities[winnerProtocol.candidates[0]]=NaN;
    const report=all([a,structuredClone(a),missing,bad]);
    expect(report).toMatchObject({registered:4,settled:3,invalidSettledOutcomes:1,duplicateSettled:2,eligibleSettled:1});
    expect(report.models[0].policies.all.invalidProbability).toBe(1);
    expect(report.models[0].policies.all.selected).toBe(0);
  });
});
