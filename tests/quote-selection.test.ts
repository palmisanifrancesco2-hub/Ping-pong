import { describe, expect, it } from 'vitest';
import { selectedQuotes,keepOpenMatch,openQuote,hasPositiveValue,bookmakerWinnerPrices,eventWinnerEstimate,nearOneFifty,oddsInRange } from '../src/shared/quote-selection';
import type { FeedMatch } from '../src/shared/board';
import { quoteIdentity } from '../src/shared/board';
import type { ValueOpportunity } from '../src/domain/value';
import type { ValueReport } from '../src/shared/value';
import {positiveEvText} from '../src/shared/format';

const now = Date.parse('2026-11-05T06:00:00Z'), time = new Date(now).toISOString();
function fixture(id: string, p: number, odds: number, lower = p - .04) {
  const q = { fixture_id: id, group_id: '920000', market_id: 'winner', sel_id: 'A', side: 'A', line: 'To Win', odds_dec: odds, ts: time };
  const m: FeedMatch = { id, home: 'A', away: 'B', league: 'Synthetic only', sport: 'table_tennis', in_play: false, kickoff_utc: new Date(now + 3600000).toISOString(), group_status: { '920000': { polled_at: time } }, quotes: [q] };
  const o: ValueOpportunity = { id, eventId: id, match: 'A — B', competition: m.league, market: 'winner', selection: 'A', odds, quoteAt: time, quoteKey: quoteIdentity(q), probability: p, probabilityLower: lower, sampleSize: 40, validationSize: 3000, modelValidated: false, fresh: true, admVerified: false, impliedProbability: 1 / odds, fairOdds: 1 / p, ev: p * odds - 1, conservativeEv: lower * odds - 1, assessment: 'Sperimentale', rank: lower * odds - 1 };
  return { m, o };
}
const report = (...rows: ValueOpportunity[]): ValueReport => ({ checkedAt: time, status: 'experimental', modelValidated: false, admVerified: false, reasons: [], opportunities: [], experimental: rows });
it('shows current Bet365 winner prices independently of the prediction filter', () => {
  const { m } = fixture('a', .6, 2);
  const [home] = m.quotes;
  const away = { ...home, sel_id: 'B', side: 'B', odds_dec: 1.26 };
  m.quotes = [away, home, { ...home, line: 'Over', sel_id: 'other' }];
  expect(bookmakerWinnerPrices(m, now)).toEqual([home, away]);
  expect(selectedQuotes(report(), [m], now)).toEqual([]);
  expect(bookmakerWinnerPrices({ ...m, quotes: [home, { ...away, market_id: 'other' }] }, now)).toEqual([]);
  expect(bookmakerWinnerPrices({ ...m, quotes: [home, { ...home, sel_id: 'duplicate' }] }, now)).toEqual([]);
  expect(bookmakerWinnerPrices({ ...m, quotes: [{ ...home, suspended: true }, away] }, now)).toEqual([away]);
  expect(bookmakerWinnerPrices({ ...m, quotes: [{ ...home, ts: new Date(now + 1).toISOString() }] }, now)).toEqual([]);
  expect(bookmakerWinnerPrices({ ...m, kickoff_utc: time }, now)).toEqual([]);

  const liveHome = { ...home, phase: 'inplay' as const };
  const live = { ...m, in_play: true, polled_at: time, quotes: [liveHome, away] };
  expect(bookmakerWinnerPrices(live, now)).toEqual([liveHome]);
  expect(bookmakerWinnerPrices(live, now + 61_000)).toEqual([]);
});

describe('probability-ranked selected quotes', () => {
  it('applies the inclusive 1.40–1.60 range without changing EV eligibility', () => {
    const lower = fixture('lower', .88, 1.4);
    const upper = fixture('upper', .8, 1.6);
    const outside = fixture('outside', .8, 1.61);
    const noValue = fixture('no-value', .6, 1.5);
    const samples = [lower,upper,outside,noValue];
    const {minimum,maximum} = nearOneFifty;
    expect(samples.filter(x=>oddsInRange(x.o.odds,minimum,maximum)).map(x=>x.o.id)).toEqual(['lower','upper','no-value']);
    expect(selectedQuotes(report(...samples.map(x=>x.o)),samples.map(x=>x.m),now,minimum,maximum).map(x=>x.id))
      .toEqual(['lower','upper']);
  });
  it('shows experimental candidates without adding them to verified rankings', () => {
    const { m, o } = fixture('a', .6, 2);
    const r: ValueReport = { ...report(o), status:'blocked', policy:'bet365-independent-v17',
      rankings:{probability:[],value:[],combined:[],weights:{probability:.5,value:.5},excluded:1,policy:'bet365-independent-v17',reasons:[]} };
    expect(selectedQuotes(r, [m], now)).toEqual([o]);
    expect(openQuote(r, m, 'A', now)).toEqual(o);
    expect(r.rankings?.value).toEqual([]);
  });
  it('shows a fresh prematch estimate with no corresponding bookmaker price', () => {
    const { m } = fixture('a', .6, 2);
    const estimate = {homeProbability:.6,sampleSize:40,modelName:'Test'};
    const r = {...report(),winnerEstimates:{[m.id]:estimate}};
    expect(eventWinnerEstimate(r, {...m,quotes:[]}, now)).toEqual(estimate);
    expect(eventWinnerEstimate(r, m, now+120_001)).toBeUndefined();
    expect(eventWinnerEstimate(r, {...m,in_play:true}, now)).toBeUndefined();
    expect(eventWinnerEstimate(r, {...m,id:'missing'}, now)).toBeUndefined();
  });
  it('filters by conservative value first, then orders by actual model probability', () => {
    const favorite = fixture('favorite', .8, 1.3, .7); // likely, but no prudent value
    const a = fixture('a', .65, 1.9), b = fixture('b', .4, 4);
    const rows = selectedQuotes(report(b.o, favorite.o, a.o), [favorite.m, b.m, a.m], now);
    expect(rows.map(r => r.id)).toEqual(['a', 'b']);
    expect(rows[0].probability).toBe(.65); expect(rows[0].probability).not.toBe(rows[0].impliedProbability);
  });
  it('rejects changed prices, timestamps, stale markets, insufficient data and live/finished events', () => {
    const { m, o } = fixture('a', .6, 2);
    for (const changed of [
      { ...m, in_play: true, polled_at: time },
      { ...m, kickoff_utc: new Date(now - 1).toISOString() },
      { ...m, group_status: {} },
      { ...m, quotes: [{ ...m.quotes[0], odds_dec: 3 }] },
      { ...m, quotes: [{ ...m.quotes[0], ts: new Date(now - 1000).toISOString() }] },
      { ...m, quotes: [{ ...m.quotes[0], suspended: true }] },
      { ...m, quotes: [{ ...m.quotes[0], fixture_id: 'wrong' }] },
    ]) expect(selectedQuotes(report(o), [changed], now)).toEqual([]);
    expect(selectedQuotes(report({ ...o, sampleSize: 29 }), [m], now)).toEqual([]);
    expect(selectedQuotes({ ...report(o), checkedAt: 'invalid' }, [m], now)).toEqual([]);
    expect(selectedQuotes(report(o), [m], now + 121000)).toEqual([]);
    expect(selectedQuotes(null, [m], now)).toEqual([]);
    expect(selectedQuotes(report(o), [m], now, 2.1)).toEqual([]);
  });
  it('keeps a single selection per event and never invents predictions for unmodeled markets', () => {
    const { m, o } = fixture('a', .6, 2);
    expect(selectedQuotes(report(o, { ...o, id: 'duplicate' }), [m], now)).toHaveLength(1);
    expect(selectedQuotes(report(), [m], now)).toEqual([]);
  });
});

it('keeps the inspected match at its original position while hiding a refreshed quote without positive EV',()=>{
 const a=fixture('a',.6,2),b=fixture('b',.65,2),c=fixture('c',.55,2.3);
 const opened={match:b.m,index:1,selection:'A'};
 const latest={...b.m,quotes:[{...b.m.quotes[0],odds_dec:1.3}]};
 expect(keepOpenMatch([a.m,c.m],opened,[a.m,latest,c.m]).map(m=>m.id)).toEqual(['a','b','c']);
 expect(keepOpenMatch([],opened,[])[0]).toBe(b.m);
 const changed={...b.o,odds:1.3,ev:-.155,conservativeEv:-.2};
 const r={...report(),estimates:[changed]};
 expect(selectedQuotes(r,[latest],now)).toEqual([]);
 expect(openQuote(r,latest,'A',now)).toBeUndefined();
 expect(openQuote(r,undefined,'A',now)).toBeUndefined();
 expect(openQuote(r,latest,'A',now+121000)).toBeUndefined();
});

it('requires strictly positive nominal and prudent EV in both lists and open panels, regardless of cached margins',()=>{
 const cases=[fixture('zero',.5,2,.5),fixture('negative',.49,2,.45),fixture('prudent-zero',.6,2,.5),fixture('prudent-negative',.6,2,.49)];
 for(const {m,o}of cases){
  const forged={...o,ev:1,conservativeEv:1};
  expect(hasPositiveValue(forged)).toBe(false);
  const r={...report(forged),estimates:[forged]};
  expect(selectedQuotes(r,[m],now)).toEqual([]);
  expect(openQuote(r,m,'A',now)).toBeUndefined();
 }
 const {m,o}=fixture('positive',.6,2,.55),r={...report(o),estimates:[o]};
 expect(selectedQuotes(r,[m],now)).toHaveLength(1);
 expect(openQuote(r,m,'A',now)).toEqual(o);
 expect(positiveEvText(.00001)).toBe('>0%');
 expect(positiveEvText(.16)).toBe('+16.0%');
});
