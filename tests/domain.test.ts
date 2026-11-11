import { describe, expect, it } from 'vitest';
import { binaryMetrics, expectedValue, fractionalKelly, impliedProbability, overround } from '../src/domain/analytics';
import { bestQuotes, comparisonKey, normalizeDisplay, type Quote } from '../src/domain/comparison';
// Explicit synthetic fixtures exclusively for unit tests, never application data.
const time = Date.parse('2026-01-01T12:00:00Z');
const quote: Quote = { source: 'test', eventId: 'synthetic-1', startsAt: '2026-01-01T13:00:00Z', homeId: 'a', awayId: 'b', market: 'total', period: 'match', unit: 'points', selection: 'over', line: 74.5, settlementRule: 'test-completed-match', bookmaker: 'test-book', odds: 2, updatedAt: '2026-01-01T11:59:00Z', admVerifiedUntil: '2026-02-01T00:00:00Z', suspended: false, mode: 'real' };
describe('transparent mathematical primitives', () => {
  it('calculates implied probability, EV and full-book overround', () => {
    expect(impliedProbability(2)).toBe(.5); expect(expectedValue(.6, 2)).toBeCloseTo(.2);
    expect(overround([1.9,1.9], true)).toBeCloseTo(2 / 1.9 - 1);
    expect(overround([1.9], false)).toBeNull(); expect(overround([1.9,1.9], false)).toBeNull();
  });
  it.each([0,1,-2,Infinity,NaN])('rejects invalid odds %s', odds => expect(() => impliedProbability(odds)).toThrow());
  it('rejects invalid probabilities', () => { expect(() => expectedValue(1.1, 2)).toThrow(); expect(() => expectedValue(NaN,2)).toThrow(); });
  it('keeps stake off unless explicitly enabled and validated', () => {
    const stake = { enabled: false, validated: true, bankroll: 1000, pLowerBound: .6, odds: 2, fraction: .25, maxStakeFraction: .02 };
    expect(fractionalKelly(stake)).toBe(0);
    expect(fractionalKelly({ ...stake, enabled: true, validated: false })).toBe(0);
    expect(fractionalKelly({ ...stake, enabled: true })).toBe(20);
    expect(fractionalKelly({ ...stake, enabled: true, pLowerBound: .4 })).toBe(0);
    expect(() => fractionalKelly({ ...stake, enabled: true, maxStakeFraction: .5 })).toThrow();
  });
  it('returns no metrics for no observations and scores known outcomes', () => {
    expect(binaryMetrics([])).toBeNull();
    expect(binaryMetrics([{ probability: .5, outcome: 1 }, { probability: .5, outcome: 0 }])).toEqual({ count: 2, brier: .25, logLoss: Math.log(2) });
  });
});
describe('conservative quote comparison', () => {
  it('normalizes whitespace without fuzzy identity matching', () => expect(normalizeDisplay('  Test   Name ')).toBe('Test Name'));
  it.each([{ line: 75.5 }, { unit: 'sets' as const }, { period: 'set_1' }, { selection: 'under' }, { eventId: 'synthetic-2' }, { startsAt: '2026-01-01T15:00:00Z' }, { homeId: 'b', awayId: 'a' }, { settlementRule: 'different' }, { source: 'other' }])('keeps different market identities separate (%j)', changes => expect(comparisonKey({ ...quote, ...changes })).not.toBe(comparisonKey(quote)));
  it('chooses the best price only within the same identity', () => {
    const result = bestQuotes([quote, { ...quote, odds: 2.2, bookmaker: 'test-book-2' }, { ...quote, line: 75.5, odds: 3 }], time);
    expect(result).toHaveLength(2); expect(result[0].odds).toBe(2.2);
  });
  it.each([{ admVerifiedUntil: null }, { admVerifiedUntil: 'bad' }, { updatedAt: 'bad' }, { updatedAt: '2026-01-01T11:00:00Z' }, { updatedAt: '2026-01-01T12:01:00Z' }, { suspended: true }, { suspended: null }, { mode: 'demo' as const }, { settlementRule: '' }, { line: null }, { odds: 1.29 }])('excludes unsafe/incomplete quotes (%j)', changes => expect(bestQuotes([{ ...quote, ...changes }], time,1.3,300,{requireAdm:true})).toEqual([]));
  it('accepts non-ADM prices by default and keeps the optional ADM check explicit',()=>{expect(bestQuotes([{...quote,admVerifiedUntil:null}],time)).toHaveLength(1);expect(bestQuotes([{...quote,admVerifiedUntil:null}],time,1.3,300,{requireAdm:true})).toEqual([]);});
  it('does not impose maximum odds', () => expect(bestQuotes([{ ...quote, odds: 100 }], time)).toHaveLength(1));
});
