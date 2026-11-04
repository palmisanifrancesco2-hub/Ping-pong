import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../server/handler';
import { authorize } from '../server/auth';
import { OddsApi } from '../server/provider';
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))); });
async function start(handler: ReturnType<typeof createHandler>) {
  const server = createServer(handler); servers.push(server);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test address');
  return `http://127.0.0.1:${address.port}`;
}
describe('private HTTP API', () => {
  it('exposes health without disclosing server configuration', async () => {
    const base = await start(createHandler({ env: { THE_ODDS_API_KEY: 'TEST_SECRET' } }));
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200); expect(res.headers.get('cache-control')).toContain('no-store');
    expect(await res.json()).toEqual({ status: 'ok', version: '0.1.0' });
  });
  it('denies unauthenticated requests before calling the provider', async () => {
    const provider = new OddsApi(undefined); const spy = vi.spyOn(provider, 'connection');
    const base = await start(createHandler({ env: {}, provider }));
    expect((await fetch(`${base}/api/connection`)).status).toBe(401);
    expect((await fetch(`${base}/api/connection`, { headers: { Authorization: 'Bearer forged' } })).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });
  it('fails closed when allowlist is absent', async () => {
    expect(await authorize('anything', {})).toBeNull();
    expect(await authorize('anything', { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test' })).toBeNull();
  });
  it('uses shared 60 second cache and refreshes after expiry', async () => {
    let now = 1000; const provider = new OddsApi(undefined); const spy = vi.spyOn(provider, 'connection');
    const base = await start(createHandler({ provider, authorize: async () => 'test-user', now: () => now }));
    const request = () => fetch(`${base}/api/connection`, { headers: { Authorization: 'Bearer test' } });
    const replies = await Promise.all([request(),request(),request()]);
    for (const res of replies) expect((await res.json()).status).toBe('not_configured');
    expect(spy).toHaveBeenCalledTimes(1);
    now += 60_001; await request(); expect(spy).toHaveBeenCalledTimes(2);
  });
  it('rejects unknown paths and unsafe methods', async () => {
    const base = await start(createHandler());
    expect((await fetch(`${base}/api/unknown`)).status).toBe(404);
    const res = await fetch(`${base}/api/connection`, { method: 'POST' });
    expect(res.status).toBe(405); expect(res.headers.get('allow')).toBe('GET');
  });
});
