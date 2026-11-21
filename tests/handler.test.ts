import{ResultsFeed}from'../server/results';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../server/handler';
import { authorize } from '../server/auth';
import { OddsApi } from '../server/provider';
import {adaptiveTrainingProtocol}from'../server/adaptive-training';
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
  it('runs candidate training after original settlement on the same protected cron',async()=>{
    const calls:string[]=[];const secret='synthetic-only-cron-secret-of-sufficient-length';
    const study={run:vi.fn(async()=>{calls.push('winner');return{status:'completed'};}),report:vi.fn()};
    const marketStudy={run:vi.fn(async()=>{calls.push('market');return{status:'completed'};}),report:vi.fn()};
    const trainer={run:vi.fn(async()=>{calls.push('training');return{status:'disabled',day:'2026-11-11',checkedAt:'2026-11-11T12:00:00Z',reason:'Synthetic QA',automaticPromotion:false as const,operationallyValidated:false as const};}),report:vi.fn()};
    const base=await start(createHandler({env:{CRON_SECRET:secret},study,marketStudy,trainer}));
    expect((await fetch(`${base}/api/study-run`)).status).toBe(401);expect(calls).toEqual([]);
    expect((await fetch(`${base}/api/study-run`,{headers:{Authorization:`Bearer ${secret}`}})).status).toBe(200);expect(calls).toEqual(['winner','market','training']);expect(trainer.run).toHaveBeenCalledWith(undefined,expect.any(Number));
  });
  it('protects candidate training, rejects overrides and keeps it distinct from model promotion',async()=>{
    const trainer={run:vi.fn(async()=>({status:'trained',day:'2026-11-11',checkedAt:'2026-11-11T12:00:00Z',reason:'Synthetic QA',automaticPromotion:false as const,operationallyValidated:false as const})),report:vi.fn(async()=>({protocol:adaptiveTrainingProtocol,enabled:true,scheduled:false,automaticPromotion:false,operationallyValidated:false,lastRun:null,runs:[],reason:'Synthetic QA'}))};
    const base=await start(createHandler({env:{},trainer,authorize:async t=>t==='member'?'owner':null}));
    for(const method of ['GET','POST'])expect((await fetch(`${base}/api/training`,{method})).status).toBe(401);
    expect(trainer.run).not.toHaveBeenCalled();expect(trainer.report).not.toHaveBeenCalled();
    expect((await fetch(`${base}/api/training`,{headers:{Authorization:'Bearer member'}})).status).toBe(200);
    const forged=await fetch(`${base}/api/training`,{method:'POST',headers:{Authorization:'Bearer member','Content-Type':'application/json'},body:JSON.stringify({validated:true})});expect(forged.status).toBe(400);expect(trainer.run).not.toHaveBeenCalled();
    const response=await fetch(`${base}/api/training`,{method:'POST',headers:{Authorization:'Bearer member'}});expect(response.status).toBe(200);expect(await response.json()).toMatchObject({automaticPromotion:false});expect(trainer.run).toHaveBeenCalledWith('owner');
  });
  it('returns forbidden for training requested by an unauthorized member',async()=>{
    const trainer={run:vi.fn(async()=>{throw Error('ADAPTIVE_OWNER_ONLY');}),report:vi.fn(async()=>{throw Error('ADAPTIVE_OWNER_ONLY');})};
    const base=await start(createHandler({env:{},trainer,authorize:async()=>'other-member'}));
    for(const method of ['GET','POST'])expect((await fetch(`${base}/api/training`,{method,headers:{Authorization:'Bearer member'}})).status).toBe(403);
  });
  it('protects the integrated system report and exposes aggregates without individual test rows',async()=>{
    const base=await start(createHandler({env:{},authorize:async t=>t==='member'?'owner':null}));
    expect((await fetch(`${base}/api/prediction-system`)).status).toBe(401);
    const response=await fetch(`${base}/api/prediction-system`,{headers:{Authorization:'Bearer member'}});expect(response.status).toBe(200);
    const body=await response.json();expect(body.version).toBe('prediction-system-v16');expect(body.benchmark.n).toBe(1804);expect(body.datasets.length).toBeGreaterThan(3);expect(body.benchmark.predictions).toBeUndefined();expect(body.lifecycle.monitor.automaticPromotion).toBe(false);expect(body.rankingPolicy.italianPricesVerified).toBe(false);
    expect((await fetch(`${base}/api/prediction-system`,{method:'POST',headers:{Authorization:'Bearer member'}})).status).toBe(405);
  });
  it('forwards an authenticated manual refresh to the board and value source',async()=>{
    const board={provider:'MoviOdds' as const,bookmakerSite:'bet365.com.au' as const,checkedAt:new Date().toISOString(),serverTime:new Date().toISOString(),warming:false,matches:[]};
    const feed={board:vi.fn(async()=>board)},analyses={analyse:vi.fn(),results:new ResultsFeed(async()=>new Response(JSON.stringify({source:'postgres',results:[]})))};
    const base=await start(createHandler({env:{},feed,analyses,authorize:async t=>t==='member'?'owner':null}));
    expect((await fetch(`${base}/api/board?refresh=1`)).status).toBe(401);expect(feed.board).not.toHaveBeenCalled();
    for(const path of ['/api/board?refresh=1','/api/value?refresh=1'])expect((await fetch(base+path,{headers:{Authorization:'Bearer member'}})).status).toBe(200);
    expect(feed.board.mock.calls).toEqual([[true],[true]]);
  });

  it('keeps the research report private and separate from validated production forecasts',async()=>{
    const base=await start(createHandler({authorize:async t=>t==='member'?'owner':null}));
    expect((await fetch(`${base}/api/model`)).status).toBe(401);
    const response=await fetch(`${base}/api/model`,{headers:{Authorization:'Bearer member'}});
    expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body=await response.json();expect(body.research.productionValidated).toBe(false);
    expect(Object.keys(body.research.candidateSelection)).toHaveLength(6);
    expect(body.research.finalPredictions).toBeUndefined();expect(body.validated).toBe(false);
    expect(body.scoreResearch.productionValidated).toBe(false);expect(body.scoreResearch.candidates).toHaveLength(9);expect(body.scoreResearch.finalPredictions).toBeUndefined();
    expect(body.forwardStudy.events).toBeGreaterThan(0);expect(body.forwardStudy.captureHash).toMatch(/^[a-f0-9]{64}$/);expect(body.forwardStudy.predictions).toBeUndefined();
    expect(body.comparison.testCases).toBe(3000);expect(body.comparison.ranking).toHaveLength(15);expect(body.comparison.productionValidated).toBe(false);expect(body.comparison.predictions).toBeUndefined();expect(body.comparison.artifacts).toBeUndefined();
  });
  it('keeps value estimates private and reports the actual model block',async()=>{
    const base=await start(createHandler({analyses:{analyse:vi.fn(),results:new ResultsFeed(async()=>new Response(JSON.stringify({source:'postgres',results:[]})))},authorize:async t=>t==='member'?'owner':null,feed:{board:async()=>({provider:'MoviOdds',bookmakerSite:'bet365.com.au',checkedAt:new Date().toISOString(),serverTime:new Date().toISOString(),warming:false,matches:[]})}}));expect((await fetch(`${base}/api/value`)).status).toBe(401);
    const response=await fetch(`${base}/api/value`,{headers:{Authorization:'Bearer member'}});expect(response.status).toBe(200);const report=await response.json();expect(report.status).toBe('blocked');expect(report.rankings.probability).toEqual([]);expect(report.policy).toBe('bet365-independent-v17');expect(report.opportunities).toEqual([]);
  });
  it('verifies private access independently from having an Auth session',async()=>{
    const denied=await start(createHandler({env:{},authorize:async()=>null}));expect((await fetch(`${denied}/api/access`,{headers:{Authorization:'Bearer registered-outsider'}})).status).toBe(401);
    const allowed=await start(createHandler({authorize:async()=>'member'}));const result=await fetch(`${allowed}/api/access`,{headers:{Authorization:'Bearer verified-member'}});
    expect(await result.json()).toEqual({authorized:true});expect(result.headers.get('cache-control')).toBe('private, no-store');
  });
  it('protects choice mutations and rejects forged fields before saving',async()=>{
    const choices={list:vi.fn(),save:vi.fn(),update:vi.fn()};const base=await start(createHandler({env:{},choices}));
    for(const method of ['POST','PATCH'])expect((await fetch(`${base}/api/choices`,{method,headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(401);
    expect(choices.save).not.toHaveBeenCalled();const privateBase=await start(createHandler({choices,authorize:async()=>'owner'}));
    const response=await fetch(`${privateBase}/api/choices`,{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({eventId:'e',userId:'other',odds:100})});
    expect(response.status).toBe(400);expect(choices.save).not.toHaveBeenCalled();
  });
  it('protects analysis and settlement from unauthorized or unsafe methods',async()=>{
    const base=await start(createHandler({env:{}}));expect((await fetch(`${base}/api/analysis?eventId=e`,{method:'POST'})).status).toBe(401);expect((await fetch(`${base}/api/settle`,{method:'POST'})).status).toBe(401);expect((await fetch(`${base}/api/settle`)).status).toBe(405);
  });
  it('protects history and validates filters before querying the database', async () => {
    const history = vi.fn();
    const denied = await start(createHandler({ env: {}, history }));
    expect((await fetch(`${denied}/api/history?period=365`)).status).toBe(401);
    expect(history).not.toHaveBeenCalled();
    const base = await start(createHandler({ history, authorize: async () => 'test-owner' }));
    expect((await fetch(`${base}/api/history?period=0`, { headers: { Authorization: 'Bearer test' } })).status).toBe(400);
    expect(history).not.toHaveBeenCalled();
    history.mockResolvedValue({ entries: [], totalRecorded: 0 });
    const response = await fetch(`${base}/api/history?period=365&status=won`, { headers: { Authorization: 'Bearer test' } });
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(history.mock.calls[0][0]).toMatchObject({ userId: 'test-owner', token: 'test', period: '365', page: 1, status: 'won' });
  });
  it('protects the complete board before requesting public provider data', async () => {
    const feed = { board: vi.fn() };
    const base = await start(createHandler({ env: {}, feed }));
    expect((await fetch(`${base}/api/board`)).status).toBe(401);
    expect(feed.board).not.toHaveBeenCalled();
  });
  it('serves the complete board privately and sanitizes upstream failures', async () => {
    const payload = { provider: 'MoviOdds' as const, bookmakerSite: 'bet365.com.au' as const, checkedAt: new Date().toISOString(), serverTime: new Date().toISOString(), warming: false, matches: [] };
    const feed = { board: vi.fn().mockResolvedValueOnce(payload).mockRejectedValue(new Error('internal details')) };
    const base = await start(createHandler({ feed, authorize: async () => 'authorized-test-user' }));
    const request = () => fetch(`${base}/api/board`, { headers: { Authorization: 'Bearer synthetic' } });
    const first = await request(); expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
    expect(await first.json()).toEqual(payload);
    const second = await request(); expect(second.status).toBe(503);
    expect(second.headers.get('retry-after')).toBe('30');
    expect(JSON.stringify(await second.json())).not.toContain('internal details');
  });
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
  it('fails closed when Supabase configuration is incomplete', async () => {
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
