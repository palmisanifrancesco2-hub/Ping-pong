import { describe, expect, it, vi } from 'vitest';
import { HISTORY_PERIODS, historyWindow, summarizeHistory } from '../src/shared/history';
import { historyEntry, parseHistoryQuery, readHistory } from '../server/history';
import { isFreshLive } from '../src/shared/board';
const now = Date.parse('2026-11-04T13:00:00Z');
function row(status: 'won' | 'lost' | 'void' | 'pending' = 'won') {
  return { id: 'synthetic-prediction', user_id: 'owner', mode: 'real', predicted_at: '2026-11-04T12:00:00Z', selection: 'Test A', probability: '0.6', sample_size: 100,
    market: { event_id: 'event-a', kind: 'winner', unit: 'match', period: 'match', line: null,
      event: { home: { display_name: 'Test A' }, away: { display_name: 'Test B' }, competition: { name: 'Synthetic league' } } },
    quote: { decimal_odds: '2.5', source_updated_at: '2026-11-04T11:59:00Z', bookmaker: { name: 'Synthetic book' } },
    model: { name: 'Synthetic model', version: 'test', validated: false },
    outcome: { status, settled_at: status === 'pending' ? null : '2026-11-04T12:30:00Z', result_event_id: 'event-a', result: { status: 'official', score: { sets: '3-1' }, source: 'synthetic-results' } } };
}
const env = { SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_SYNTHETIC' };
function response(rows: unknown[], total = rows.length) { return Response.json(rows, { headers: { 'content-range': `*/${total}` } }); }
describe('recorded predictions and rolling intervals (synthetic only)', () => {
  it('supports days, weeks, every month through one year and complete history', () => {
    for (const [period] of HISTORY_PERIODS) {
      const w = historyWindow(period, now);
      expect(w.to).toBe('2026-11-04T13:00:00.000Z');
      expect(w.from).toBe(period === 'all' ? null : new Date(now - Number(period) * 86400000).toISOString());
    }
    expect(historyWindow('1', now).from).toBe('2026-11-03T13:00:00.000Z');
    for (const invalid of ['0','-1','366','NaN','forever']) expect(() => historyWindow(invalid, now)).toThrow();
  });
  it('excludes void, pending and unverified rows from the correctness denominator', () => {
    const entries = ['won','lost','void','pending'].map(s => historyEntry(row(s as 'won'), 'owner', now));
    const invalid = row(); invalid.outcome.result_event_id = 'different-event';
    const summary = summarizeHistory([...entries, historyEntry(invalid, 'owner', now)]);
    expect(summary).toEqual({ won: 1, lost: 1, void: 1, pending: 1, unverified: 1, hitRate: 0.5, theoreticalProfit: 0.5 });
    expect(summarizeHistory([]).hitRate).toBeNull(); expect(summarizeHistory([]).theoreticalProfit).toBeNull();
  });
  it('uses recorded outcomes only and never infers wins from probability or a score', () => {
    expect(historyEntry({ ...row(), outcome: null }, 'owner', now).status).toBe('pending');
    expect(historyEntry({ ...row(), outcome: [] }, 'owner', now).status).toBe('pending');
    const bad = row(); bad.outcome.result.status = 'cancelled';
    expect(historyEntry(bad, 'owner', now).status).toBe('unverified');
    bad.outcome.result.status = 'official'; bad.outcome.settled_at = '2026-11-04T14:00:00Z';
    expect(historyEntry(bad, 'owner', now).status).toBe('unverified');
    expect(historyEntry(row('void'), 'owner', now).theoreticalProfit).toBe(0);
  });
  it('rejects other owners, demo, malformed probabilities and nonfinite prices', () => {
    expect(() => historyEntry(row(), 'other', now)).toThrow();
    expect(() => historyEntry({ ...row(), mode: 'demo' }, 'owner', now)).toThrow();
    for (const probability of [null, '', 'NaN', 'Infinity', -1, 2]) expect(() => historyEntry({ ...row(), probability }, 'owner', now)).toThrow();
  });
  it('applies JWT, owner, real mode and time window to the read-only database request', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/rest/v1/predictions'); expect(init?.method).toBe('GET');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer synthetic-token');
      expect(url.searchParams.get('user_id')).toBe('eq.owner'); expect(url.searchParams.get('mode')).toBe('eq.real');
      expect(url.searchParams.getAll('predicted_at')).toContain('gte.2026-11-03T13:00:00.000Z');
      return response([row()]);
    });
    const report = await readHistory({ token: 'synthetic-token', userId: 'owner', env, period: '1', page: 1, status: 'all' }, fetcher, now);
    expect(report.totalRecorded).toBe(1); expect(report.entries[0].theoreticalProfit).toBe(1.5); expect(report.partial).toBe(false);
  });
  it('counts the entire interval before filtering and paginating; handles empty data honestly', async () => {
    const fetcher = vi.fn().mockResolvedValue(response([row('won'), { ...row('lost'), id: 'other' }]));
    const report = await readHistory({ token: 'test', userId: 'owner', env, period: '365', page: 1, status: 'lost' }, fetcher, now);
    expect(report.summary.won).toBe(1); expect(report.entries).toHaveLength(1); expect(report.entries[0].status).toBe('lost');
    const empty = await readHistory({ token: 'test', userId: 'owner', env, period: 'all', page: 1, status: 'all' }, vi.fn().mockResolvedValue(response([])), now);
    expect(empty.totalRecorded).toBe(0); expect(empty.summary.hitRate).toBeNull();
  });
  it('reads past the first 1000 rows and reports a capped analysis explicitly', async () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => ({ ...row(), id: String(i) }));
    const fetcher = vi.fn().mockResolvedValueOnce(response(make(1000), 1001)).mockResolvedValueOnce(response(make(1), 1001));
    const full = await readHistory({ token: 't', userId: 'owner', env, period: '365', page: 21, status: 'all' }, fetcher, now);
    expect(full.analyzed).toBe(1001); expect(full.partial).toBe(false); expect(full.entries).toHaveLength(1);
    const capped = await readHistory({ token: 't', userId: 'owner', env, period: 'all', page: 1, status: 'all' }, vi.fn(async () => response(make(1000), 10001)), now);
    expect(capped.partial).toBe(true); expect(capped.analyzed).toBe(10000); expect(capped.totalRecorded).toBe(10001);
  });
  it('sanitizes database failures rather than presenting them as an empty history', async () => {
    await expect(readHistory({ token: 't', userId: 'owner', env, period: '7', page: 1, status: 'all' }, vi.fn(async () => new Response('private upstream details', { status: 500 })), now)).rejects.toThrow(/^HISTORY_UNAVAILABLE$/);
  });
  it('rejects invalid API query parameters', () => {
    expect(parseHistoryQuery(new URLSearchParams())).toEqual({ period: '30', page: 1, status: 'all' });
    for (const query of ['period=0','page=-1','page=1.5','page=0','status=unknown']) expect(() => parseHistoryQuery(new URLSearchParams(query))).toThrow();
  });
  it('uses a LIVE badge only with the provider flag and a recent fixture read', () => {
    const match = { id: 't', home: 'A', away: 'B', league: 'T', sport: 'table_tennis' as const, in_play: true, polled_at: new Date(now).toISOString(), quotes: [] };
    expect(isFreshLive(match, now)).toBe(true); expect(isFreshLive(match, now + 61000)).toBe(false);
    expect(isFreshLive({ ...match, in_play: false }, now)).toBe(false); expect(isFreshLive({ ...match, polled_at: undefined }, now)).toBe(false);
  });
});
