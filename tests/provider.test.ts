import { describe, expect, it, vi } from 'vitest';
import { OddsApi, ProviderError, isTableTennis } from '../server/provider';

const sport = { key: 'table_tennis_test', group: 'Table Tennis', title: 'TT Cup', description: 'Synthetic TEST fixture, never real data', active: true, has_outrights: false };
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers });
describe('The Odds API adapter', () => {
  it('makes no request without a key', async () => {
    const fetcher = vi.fn(); const result = await new OddsApi(undefined, fetcher).connection();
    expect(result.status).toBe('not_configured'); expect(fetcher).not.toHaveBeenCalled();
    expect(result.competitions.every(c => c.status === 'unverified')).toBe(true);
  });
  it('uses the documented host, query auth, all sports and returns only safe metadata', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      const parsed = new URL(String(url));
      expect(parsed.origin).toBe('https://api.the-odds-api.com');
      expect(parsed.pathname).toBe('/v4/sports/'); expect(parsed.searchParams.get('all')).toBe('true');
      expect(parsed.searchParams.get('apiKey')).toBe('TEST_SECRET');
      return json([sport], 200, { 'x-requests-remaining': '400', 'x-requests-used': '100', 'x-requests-last': '0' });
    });
    const report = await new OddsApi('TEST_SECRET', fetcher as typeof fetch).connection();
    expect(report.status).toBe('connected'); expect(report.tableTennisKeys).toEqual([sport.key]);
    expect(report.quota).toEqual({ remaining: 400, used: 100, last: 0 });
    expect(report.competitions.find(c => c.name === 'TT Cup')?.status).toBe('catalog_match');
    expect(JSON.stringify(report)).not.toContain('TEST_SECRET'); expect(report.adm).toBe('unverified'); expect(report.live).toBe('unverified');
  });
  it('never mistakes tennis for table tennis', async () => {
    expect(isTableTennis({ key: 'tennis_atp', group: 'Tennis', title: 'ATP' })).toBe(false);
    const report = await new OddsApi('test', vi.fn(async () => json([{ ...sport, key: 'tennis_atp', group: 'Tennis', title: 'ATP' }]))).connection();
    expect(report.tableTennisKeys).toEqual([]); expect(report.competitions.every(c => c.status === 'not_in_catalog')).toBe(true);
  });
  it.each([401,403,404,422,500])('sanitizes upstream errors (%s)', async status => {
    const report = await new OddsApi('TEST_SECRET', vi.fn(async () => json({ url: 'https://host?apiKey=TEST_SECRET' }, status))).connection();
    expect(report.status).toBe('error'); expect(JSON.stringify(report)).not.toContain('TEST_SECRET');
  });
  it('does not treat an error as evidence of missing coverage', async () => {
    const report = await new OddsApi('test', vi.fn(async () => json({}, 401))).connection();
    expect(report.competitions.every(c => c.status === 'unverified')).toBe(true);
  });
  it('rejects changed or incomplete schemas and non JSON', async () => {
    for (const response of [json({ data: [] }), json([{ key: 'table_tennis' }]), new Response('not-json')]) {
      expect((await new OddsApi('test', vi.fn(async () => response)).connection()).status).toBe('error');
    }
  });
  it('sanitizes network exceptions', async () => {
    const report = await new OddsApi('TEST_SECRET', vi.fn(async () => { throw new Error('https://upstream?apiKey=TEST_SECRET'); })).connection();
    expect(report.message).toBe('Connessione al fornitore non riuscita.');
    expect(JSON.stringify(report)).not.toContain('TEST_SECRET');
  });
  it('keeps timeout active until the response body is read', async () => {
    const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) => {
      return { ok: true, headers: new Headers(), json: () => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))) } as unknown as Response;
    });
    const report = await new OddsApi('test', fetcher as typeof fetch, 10).connection();
    expect(report.message).toContain('Timeout');
  });
  it('honors rate limits without retry storms', async () => {
    const fetcher = vi.fn(async () => json({}, 429, { 'retry-after': '45' }));
    const provider = new OddsApi('test', fetcher);
    await expect(provider.sports()).rejects.toMatchObject({ code: 'RATE_LIMIT', retryAfterSeconds: 45 });
    await expect(provider.sports()).rejects.toBeInstanceOf(ProviderError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects unsafe sport ids before fetching', async () => {
    const fetcher = vi.fn();
    expect(() => new OddsApi('test', fetcher).events('../admin?x=1')).toThrow('Identificativo non valido');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fetches events using only documented parameters', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => { const u = new URL(String(url)); expect(u.pathname).toBe('/v4/sports/table_tennis_test/events'); expect(u.searchParams.get('dateFormat')).toBe('iso'); return json([]); });
    expect(await new OddsApi('test', fetcher as typeof fetch).events('table_tennis_test')).toEqual([]);
  });
});
