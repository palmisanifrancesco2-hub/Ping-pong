import { describe, expect, it, vi } from 'vitest';
import { checkMoviOdds, MOVIODDS_URL, moviOddsReport } from '../server/moviodds-discovery.js';
const now = '2026-11-04T12:00:00Z';
const match = { id: 'synthetic', sport: 'table_tennis', home: 'Test A', away: 'Test B', league: 'Challenger Series TT', in_play: true,
  quotes: [{ fixture_id: 'synthetic', group_id: '920000', odds_dec: 0, suspended: true, ts: now }] };
const payload = { server_time: now, matches: [match] };
describe('MoviOdds discovery using synthetic fixtures', () => {
  it('keeps foreign prices separate from ADM and operational coverage', () => {
    const report = moviOddsReport(payload, now);
    expect(report).toMatchObject({ bookmakerSite: 'bet365.com.au', italianPricesVerified: false, operationalComparisons: false, reportedQuoteEntries: 1 });
    expect(report.competitions.find(c => c.name === 'Challenger Series')?.observedMatches).toBe(1);
  });
  it('rejects stale, future and malformed timestamps', () => {
    for (const server_time of ['2026-11-04T11:00:00Z', '2026-11-04T13:00:00Z', 'invalid']) {
      expect(() => moviOddsReport({ ...payload, server_time }, now)).toThrow();
    }
  });
  it('rejects duplicates, wrong sport and cross-event prices', () => {
    expect(() => moviOddsReport({ ...payload, matches: [match, match] }, now)).toThrow();
    expect(() => moviOddsReport({ ...payload, matches: [{ ...match, sport: 'tennis' }] }, now)).toThrow();
    expect(() => moviOddsReport({ ...payload, matches: [{ ...match, id: 'other' }] }, now)).toThrow();
  });
  it('makes one public request without credentials or retry', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ server_time: new Date().toISOString(), matches: [] }));
    expect(await checkMoviOdds(fetcher)).toMatchObject({ reportedMatches: 0 });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(MOVIODDS_URL, expect.objectContaining({ redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } }));
  });
  it('sanitizes provider errors and rate limits', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('upstream details', { status: 429 }));
    await expect(checkMoviOdds(fetcher)).rejects.toThrow(/^MOVIODDS_DISCOVERY_FAILED$/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
