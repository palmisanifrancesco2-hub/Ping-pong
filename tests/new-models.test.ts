import { expect, it } from 'vitest';
import { glickoUpdate, glickoProbability,DailyGlicko } from '../src/domain/glicko2';
import { pointToSet, matchSetDistribution } from '../src/domain/set-model';
it('reproduces Glickman’s published Glicko-2 numerical example', () => {
  const r = glickoUpdate({ rating: 1500, rd: 200, sigma: .06 }, [
    { opponent: { rating: 1400, rd: 30, sigma: .06 }, score: 1 },
    { opponent: { rating: 1550, rd: 100, sigma: .06 }, score: 0 },
    { opponent: { rating: 1700, rd: 300, sigma: .06 }, score: 0 },
  ]);
  expect(r.rating).toBeCloseTo(1464.06, 1); expect(r.rd).toBeCloseTo(151.52, 1); expect(r.sigma).toBeCloseTo(.059996, 5);
  const a = { rating: 1500, rd: 200, sigma: .06 }, b = { rating: 1700, rd: 80, sigma: .06 };
  expect(glickoProbability(a, b) + glickoProbability(b, a)).toBeCloseTo(1);
});
it('conserves all mass and handles the infinite deuce tail without random predictions', () => {
  expect(pointToSet(.5)).toBeCloseTo(.5); expect(pointToSet(.6)).toBeGreaterThan(.5);
  expect(pointToSet(.6) + pointToSet(.4)).toBeCloseTo(1);
  const d = matchSetDistribution(.5); expect(d.scores.reduce((n, s) => n + s.probability, 0)).toBeCloseTo(1);
  expect(d.winner).toBeCloseTo(.5); expect(d.over35).toBeCloseTo(.75); expect(d.over45).toBeCloseTo(.375);
  expect(() => pointToSet(1)).toThrow();
});

it('does not let current-day or future outcomes leak into a Glicko prediction',()=>{
 const day=Date.parse('2026-11-05T00:00:00Z'),m={home:'A',away:'B',league:'Synthetic'};
 const r={...m,id:'future',finishedAt:new Date(day+3600000).toISOString(),availableAt:new Date(day+3600000).toISOString(),homeWon:true,sets:[[11,5],[11,5],[11,5]]as[number,number][]};
 const first=new DailyGlicko([r]);expect(first.at(m,day+7200000).p).toBe(.5);
 expect(first.at(m,day+86400000).p).toBeGreaterThan(.5);
});
