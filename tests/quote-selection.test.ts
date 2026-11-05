import { describe, expect, it } from 'vitest';
import { selectedQuotes,keepOpenMatch,openQuote } from '../src/shared/quote-selection';
import type { FeedMatch } from '../src/shared/board';
import { quoteIdentity } from '../src/shared/board';
import type { ValueOpportunity } from '../src/domain/value';
import type { ValueReport } from '../src/shared/value';

const now = Date.parse('2026-11-05T06:00:00Z'), time = new Date(now).toISOString();
function fixture(id: string, p: number, odds: number, lower = p - .04) {
  const q = { fixture_id: id, group_id: '920000', market_id: 'winner', sel_id: 'A', side: 'A', line: 'To Win', odds_dec: odds, ts: time };
  const m: FeedMatch = { id, home: 'A', away: 'B', league: 'Synthetic only', sport: 'table_tennis', in_play: false, kickoff_utc: new Date(now + 3600000).toISOString(), group_status: { '920000': { polled_at: time } }, quotes: [q] };
  const o: ValueOpportunity = { id, eventId: id, match: 'A — B', competition: m.league, market: 'winner', selection: 'A', odds, quoteAt: time, quoteKey: quoteIdentity(q), probability: p, probabilityLower: lower, sampleSize: 40, validationSize: 3000, modelValidated: false, fresh: true, admVerified: false, impliedProbability: 1 / odds, fairOdds: 1 / p, ev: p * odds - 1, conservativeEv: lower * odds - 1, assessment: 'Sperimentale', rank: lower * odds - 1 };
  return { m, o };
}
const report = (...rows: ValueOpportunity[]): ValueReport => ({ checkedAt: time, status: 'experimental', modelValidated: false, admVerified: false, reasons: [], opportunities: [], experimental: rows });
describe('probability-ranked selected quotes', () => {
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

it('keeps the inspected match at its original position and accepts fresh non-value updates only inside that panel',()=>{
 const a=fixture('a',.6,2),b=fixture('b',.65,2),c=fixture('c',.55,2.3);
 const opened={match:b.m,index:1,selection:'A'};
 const latest={...b.m,quotes:[{...b.m.quotes[0],odds_dec:1.3}]};
 expect(keepOpenMatch([a.m,c.m],opened,[a.m,latest,c.m]).map(m=>m.id)).toEqual(['a','b','c']);
 expect(keepOpenMatch([],opened,[])[0]).toBe(b.m);
 const changed={...b.o,odds:1.3,ev:-.155,conservativeEv:-.2};
 const r={...report(),estimates:[changed]};
 expect(selectedQuotes(r,[latest],now)).toEqual([]);
 expect(openQuote(r,latest,'A',now)?.odds).toBe(1.3);
 expect(openQuote(r,undefined,'A',now)).toBeUndefined();
 expect(openQuote(r,latest,'A',now+121000)).toBeUndefined();
});
