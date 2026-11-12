import { expect, it } from 'vitest';
import { coherentMatchMarkets, totalSetsLine, totalPointsLine, setHandicap, pointHandicap, exactSetScoreProbability } from '../src/domain/coherent-markets';
import { pointToSet, matchSetDistribution } from '../src/domain/set-model';

const rules = { bestOf: 5, pointsToWin: 11, winBy: 2 } as const;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

it('matches the established analytic set/match model and preserves exact-score mass in BO5 and BO7', () => {
  for (const bestOf of [5, 7] as const) for (const p of [.25, .5, .7]) {
    const r = coherentMatchMarkets(p, { ...rules, bestOf }, 128), previous = matchSetDistribution(pointToSet(p), bestOf);
    expect(r.exactMatchScores).toHaveLength(bestOf + 1);
    expect(sum(r.exactMatchScores.map(x => x.probability))).toBeCloseTo(1, 12);
    expect(r.winner.home + r.winner.away).toBe(1);
    expect(r.winner.home).toBeCloseTo(previous.winner, 12);
    expect(sum(r.totalSets.map(x => x.probability))).toBeCloseTo(1, 12);
    expect(r.operationallyValidated).toBe(false);
  }
  const fair = coherentMatchMarkets(.5, rules, 128);
  expect(totalSetsLine(fair, 3.5).over).toBeCloseTo(.75, 12);
  expect(totalSetsLine(fair, 4.5).over).toBeCloseTo(.375, 12);
});

it('keeps the infinite deuce tail and every total-points line below the cap exact', () => {
  const a = coherentMatchMarkets(.53, rules, 86), b = coherentMatchMarkets(.53, rules, 160);
  expect(sum(a.matchPoints.probabilities) + a.matchPoints.overflowProbability).toBeCloseTo(1, 12);
  expect(a.matchPoints.overflowProbability).toBeGreaterThan(0);
  for (const line of [50, 74.5, 79.5, 84.5]) {
    const x = totalPointsLine(a.matchPoints, line), y = totalPointsLine(b.matchPoints, line);
    expect(x.over).toBeCloseTo(y.over, 12); expect(x.under).toBeCloseTo(y.under, 12);
    expect(x.push + x.over + x.under).toBeCloseTo(1, 12);
  }
  expect(totalPointsLine(a.matchPoints, 74.5).push).toBe(0);
  expect(totalPointsLine(a.matchPoints, 74).push).toBeGreaterThan(0);
  expect(() => totalPointsLine(a.matchPoints, 86)).toThrow('OVERFLOW');
});

it('keeps handicap, nested thresholds, player reversal and conditional set semantics consistent', () => {
  const a = coherentMatchMarkets(.61, rules, 128), b = coherentMatchMarkets(.39, rules, 128);
  expect(a.winner.home).toBeCloseTo(b.winner.away, 12);
  for (const line of [-9.5, -5.5, 0, 5.5, 9.5]) {
    const home = pointHandicap(a.pointMargin, 'home', line), away = pointHandicap(b.pointMargin, 'away', line);
    expect(home.over).toBeCloseTo(away.over, 12); expect(sum(Object.values(home))).toBeCloseTo(1, 12);
  }
  expect(setHandicap(a, 'home', -1.5).over).toBeCloseTo(a.exactMatchScores.filter(s => s.home - s.away > 1.5).reduce((s, x) => s + x.probability, 0), 12);
  expect(totalPointsLine(a.matchPoints, 74.5).over).toBeGreaterThanOrEqual(totalPointsLine(a.matchPoints, 79.5).over);
  for (const s of a.sets) {
    expect(s.homeAndPlayed + s.awayAndPlayed + s.notPlayed).toBeCloseTo(1, 12);
    expect(s.homeGivenPlayed).toBeCloseTo(a.setHomeProbability, 12);
  }
  expect(a.sets[3].playedProbability).toBeCloseTo(totalSetsLine(a, 3.5).over, 12);
  expect(a.sets[4].playedProbability).toBeCloseTo(totalSetsLine(a, 4.5).over, 12);
  expect(a.winsAtLeastOneSet.home + a.sweep.away).toBeCloseTo(1, 12);
});

it('uses an explicit first-set-loss definition of comeback and handles deterministic matches', () => {
  const r = coherentMatchMarkets(.5, rules, 128);
  // After losing first set, home can win 3-1 (one order) or 3-2 (three orders).
  expect(r.comeback.probability).toBeCloseTo(.5 * (.5 ** 3 + 3 * .5 ** 4), 12);
  expect(r.comeback.homeWinGivenFirstSetLost).toBeCloseTo(.3125, 12);
  const won = coherentMatchMarkets(1, rules, 86), lost = coherentMatchMarkets(0, rules, 86);
  expect(won.winner.home).toBe(1); expect(lost.winner.home).toBe(0);
  expect(won.expectedMatchPoints).toBe(33); expect(won.matchPoints.probabilities[33]).toBe(1);
  expect(won.comeback.homeWinGivenFirstSetLost).toBeNull();
  expect(won.sets[3].homeGivenPlayed).toBeNull(); expect(won.sets[3].notPlayed).toBe(1);
});

it('supports explicit alternative formats and set targets without pretending to infer competition rules', () => {
  const r = coherentMatchMarkets(.5, { bestOf: 1, pointsToWin: 2, winBy: 2 }, 30);
  expect(r.expectedSetPoints).toBeCloseTo(4, 12);
  expect(r.expectedMatchPoints).toBeCloseTo(4, 12);
  expect(r.exactMatchScores).toHaveLength(2);
  expect(exactSetScoreProbability(r, 2, 0)).toBeCloseTo(.25, 12);
  expect(exactSetScoreProbability(r, 3, 1)).toBeCloseTo(.125, 12);
  for (const bestOf of [0, 2, 11, 3.5]) expect(() => coherentMatchMarkets(.5, { ...rules, bestOf })).toThrow();
  for (const p of [-.1, 1.1, NaN]) expect(() => coherentMatchMarkets(p, rules)).toThrow();
  expect(() => coherentMatchMarkets(.5, { ...rules, winBy: 3 } as never)).toThrow();
});

it('computes exact legal set scores including deuce and exposes conditional single-set totals', () => {
  const r = coherentMatchMarkets(.58, rules, 128);
  expect(exactSetScoreProbability(r, 11, 10)).toBe(0); expect(exactSetScoreProbability(r, 13, 10)).toBe(0);
  expect(exactSetScoreProbability(r, 12, 10)).toBeGreaterThan(0);
  expect(exactSetScoreProbability(r, 13, 11) / exactSetScoreProbability(r, 12, 10)).toBeCloseTo(2 * .58 * .42, 12);
  let mass = 0;
  for (let a = 0; a <= 120; a++) for (let b = 0; b <= 120; b++) mass += exactSetScoreProbability(r, a, b);
  expect(mass).toBeCloseTo(1, 12);
  expect(sum(r.setPoints.probabilities) + r.setPoints.overflowProbability).toBeCloseTo(1, 12);
  expect(totalPointsLine(r.setPoints, 19.5).over + totalPointsLine(r.setPoints, 19.5).under).toBeCloseTo(1, 12);
  expect(() => exactSetScoreProbability(r, 1.5, 0)).toThrow();
});
