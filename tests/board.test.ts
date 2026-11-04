import { describe, expect, it, vi } from 'vitest';
import { filterBoard, marketIdentity, quoteIdentity, quoteStatus, type FeedMatch } from '../src/shared/board';
import { MoviOddsFeed, parseBoard } from '../server/moviodds';
const time = '2026-11-04T12:00:00Z'; const now = Date.parse(time);
const q = { fixture_id: 'synthetic', group_id: '238', group_name: 'Game 2', market_id: 'winner', market_key: '238|2', period: '2', sel_id: 'a', side: 'Test A', line: 'Over', handicap: '74.5', odds_dec: 2, ts: time, phase: 'inplay' as const };
const match: FeedMatch = { id: 'synthetic', sport: 'table_tennis', home: 'Test A', away: 'Test B', league: 'Previously unknown league', in_play: true,
  polled_at: time, group_status: { '238': { polled_at: time } }, quotes: [q] };
const payload = { server_time: time, matches: [match] };
describe('all-market foreign board', () => {
  it('preserves unknown competitions, selections, period, line and all documented fields', () => {
    expect(parseBoard(payload, time).matches[0]).toEqual(match);
  });
  it('rejects duplicates, cross-event quotes, wrong sport, stale and future responses', () => {
    for (const p of [
      { ...payload, matches: [match, match] },
      { ...payload, matches: [{ ...match, quotes: [q, q] }] },
      { ...payload, matches: [{ ...match, id: 'different' }] },
      { ...payload, matches: [{ ...match, sport: 'tennis' }] },
      { ...payload, server_time: '2026-11-04T11:00:00Z' },
      { ...payload, server_time: '2026-11-04T13:00:00Z' },
    ]) expect(() => parseBoard(p, time)).toThrow();
  });
  it('distinguishes sub-markets, dynamic periods and phases with the same selection id', () => {
    const keys = [q, { ...q, market_id: 'total' }, { ...q, period: '3' }, { ...q, market_key: '238|3' }, { ...q, phase: 'prematch' as const }].map(quoteIdentity);
    expect(new Set(keys).size).toBe(5);
    expect(marketIdentity(q)).not.toBe(marketIdentity({ ...q, market_id: 'total' }));
  });
  it('never treats price change time or another market read as evidence of freshness', () => {
    expect(quoteStatus(match, q, now)).toBe('Letta di recente dalla fonte');
    expect(quoteStatus({ ...match, group_status: undefined }, q, now)).toBe('Aggiornamento non confermato');
    expect(quoteStatus({ ...match, group_status: { '238': { polled_at: time, stale: true } } }, q, now)).toBe('Aggiornamento non confermato');
    expect(quoteStatus(match, q, now + 61_000)).toBe('Aggiornamento non confermato');
    expect(quoteStatus(match, { ...q, suspended: true }, now)).toBe('Sospesa / non disponibile');
    expect(quoteStatus(match, { ...q, phase: 'prematch' }, now)).toBe('Prematch archiviata');
  });
  it('filters exactly by competition and market and keeps unavailable rows explicit', () => {
    const f = { search: 'TEST a', competition: match.league, market: 'Game 2', state: 'live', minOdds: 1.3, includeUnavailable: true };
    expect(filterBoard([match], f, now)).toEqual([match]);
    expect(filterBoard([match], { ...f, competition: 'Different' }, now)).toEqual([]);
    expect(filterBoard([match], { ...f, market: 'Game 3' }, now)).toEqual([]);
    expect(filterBoard([match], { ...f, minOdds: 3 }, now)).toEqual([]);
    expect(filterBoard([{ ...match, quotes: [{ ...q, odds_dec: 0 }] }], f, now)).toHaveLength(1);
    expect(filterBoard([{ ...match, quotes: [{ ...q, odds_dec: 0 }] }], { ...f, includeUnavailable: false }, now)).toEqual([]);
  });
  it('deduplicates concurrent requests, caches for 30 seconds and refreshes thereafter', async () => {
    let clock = now;
    const fetcher = vi.fn(async () => Response.json(payload));
    const feed = new MoviOddsFeed(fetcher, () => clock);
    const replies = await Promise.all([feed.board(), feed.board(), feed.board()]);
    expect(replies[0].bookmakerSite).toBe('bet365.com.au');
    expect(fetcher).toHaveBeenCalledTimes(1);
    clock += 30_001; await feed.board(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('applies error cooldown without retries or returning expired cached prices', async () => {
    let clock = now;
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(payload)).mockResolvedValue(new Response('upstream details', { status: 429 }));
    const feed = new MoviOddsFeed(fetcher, () => clock);
    await feed.board(); clock += 30_001;
    await expect(feed.board()).rejects.toThrow(/^MOVIODDS_UNAVAILABLE$/);
    await expect(feed.board()).rejects.toThrow(/^MOVIODDS_COOLDOWN$/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('bounds decompressed responses and sanitizes HTML, invalid JSON and errors', async () => {
    for (const response of [new Response('x'.repeat(3_500_001)), new Response('<html>error</html>'), Response.json({})]) {
      await expect(new MoviOddsFeed(vi.fn().mockResolvedValue(response), () => now).board()).rejects.toThrow(/^MOVIODDS_UNAVAILABLE$/);
    }
  });
});
