import { describe, expect, it, vi } from 'vitest';
import { discoverOddsPapi } from '../server/oddspapi-discovery.js';

const sports = [{ sportId: 999, slug: 'table-tennis', sportName: 'Table Tennis' }];
const books = [{ bookmakerName: 'Synthetic IT', slug: 'synthetic.it', liveOdds: null, cloneOf: null }];
describe('manual OddsPapi discovery (synthetic fixtures)', () => {
  it('makes no request without opt-in or a distinct key', async () => {
    const fetcher = vi.fn();
    await expect(discoverOddsPapi('secret', false, fetcher)).rejects.toThrow('OPT_IN_REQUIRED');
    await expect(discoverOddsPapi('', true, fetcher)).rejects.toThrow('KEY_MISSING');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses documented URLs, two requests and never equates Italian naming with ADM or live coverage', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(sports)).mockResolvedValueOnce(Response.json(books));
    const result = await discoverOddsPapi('synthetic-secret', true, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(c => (c[0] as URL).pathname)).toEqual(['/v4/sports', '/v4/bookmakers']);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' });
    expect(result).toMatchObject({ tableTennis: sports[0], admStatus: 'unverified', liveTableTennisStatus: 'unverified', operationalComparisons: false });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');
  });
  it.each([401, 429, 500])('stops without retry on HTTP %s and does not expose bodies', async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response('secret-in-body', { status }));
    await expect(discoverOddsPapi('secret', true, fetcher)).rejects.toThrow(/^ODDSPAPI_DISCOVERY_FAILED$/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown schema before consuming a second request', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([{ sportId: 999, name: 'Wrong schema' }]));
    await expect(discoverOddsPapi('secret', true, fetcher)).rejects.toThrow(/^ODDSPAPI_DISCOVERY_FAILED$/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('sanitizes network failures containing a credential', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('https://example.test/?apiKey=secret'));
    await expect(discoverOddsPapi('secret', true, fetcher)).rejects.toThrow(/^ODDSPAPI_DISCOVERY_FAILED$/);
  });
  it('reports absent sport honestly', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json([]));
    expect(await discoverOddsPapi('secret', true, fetcher)).toMatchObject({ tableTennis: null });
  });
});
