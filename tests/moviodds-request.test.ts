import {describe, expect, it, vi} from 'vitest';
import {movioddsRequest} from '../server/moviodds-request';
import {MoviOddsFeed} from '../server/moviodds';
import {ResultsFeed} from '../server/results';
import {checkMoviOdds} from '../server/moviodds-discovery';

const env = {MOVIODDS_API_KEY: 'synthetic-provider-key-only'};
describe('private MoviOdds authentication', () => {
  it('sends the private key in the documented header for odds, results and closing, never in URLs', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('{}'));
    for (const path of ['/odds?sport=table_tennis', '/results?sport=table_tennis', '/closing?fi=synthetic']) {
      await movioddsRequest('https://moviodds.com'+path, {headers: {'X-API-Key': 'untrusted-override'}}, fetcher, env);
      const [url, init] = fetcher.mock.calls.at(-1)!;
      expect(String(url)).not.toContain(env.MOVIODDS_API_KEY);
      expect(new Headers(init?.headers).get('X-API-Key')).toBe(env.MOVIODDS_API_KEY);
      expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
      expect(init?.redirect).toBe('error');
    }
  });
  it('refuses foreign origins and credentials before making any request', () => {
    const fetcher = vi.fn();
    for (const url of ['http://moviodds.com/odds', 'https://moviodds.com.evil.example/odds',
      'https://example.com/', 'https://user:password@moviodds.com/odds', 'https://moviodds.com:8443/odds']) {
      expect(() => movioddsRequest(url, {}, fetcher, env)).toThrow('MOVIODDS_UNTRUSTED_ORIGIN');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects header injection without including the key in errors', () => {
    const fetcher = vi.fn();
    for (const key of ['synthetic\r\nX-Other: injected', 'x'.repeat(4097)]) {
      expect(() => movioddsRequest('https://moviodds.com/odds', {}, fetcher, {MOVIODDS_API_KEY: key}))
        .toThrow('MOVIODDS_INVALID_KEY');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not use caller-supplied keys when private configuration is absent', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('', {status: 401}));
    const signal = new AbortController().signal;
    expect((await movioddsRequest('https://moviodds.com/odds', {headers: {'X-API-Key':'untrusted'}, signal}, fetcher, {})).status).toBe(401);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('X-API-Key')).toBe(false);
    expect(fetcher.mock.calls[0][1]?.signal).toBe(signal);
  });
  it('uses injected private configuration in board, results and discovery clients', async () => {
    const now = Date.parse('2026-11-17T12:00:00Z');
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('X-API-Key')).toBe(env.MOVIODDS_API_KEY);
      return Response.json(String(url).includes('/results') ? {source:'postgres', results:[]} :
        {server_time:new Date(now).toISOString(), matches:[]});
    });
    expect((await new MoviOddsFeed(fetcher, () => now, env).board()).matches).toEqual([]);
    expect((await new ResultsFeed(fetcher, () => now, env).archive()).source).toBe('postgres');
    const actualTimeFetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('X-API-Key')).toBe(env.MOVIODDS_API_KEY);
      return Response.json({server_time:new Date().toISOString(), matches:[]});
    });
    expect((await checkMoviOdds(actualTimeFetcher, env)).reportedMatches).toBe(0);
  });
  it('sanitizes provider denial bodies and keeps cooldown rather than retrying', async () => {
    const fetcher = vi.fn(async () => new Response(env.MOVIODDS_API_KEY, {status:403}));
    const feed = new MoviOddsFeed(fetcher, Date.now, env);
    await expect(feed.board()).rejects.toThrow('MOVIODDS_UNAVAILABLE');
    await expect(feed.board()).rejects.toThrow('MOVIODDS_COOLDOWN');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(new ResultsFeed(fetcher, Date.now, env).archive()).rejects.toThrow('RESULTS_UNAVAILABLE');
  });
});
