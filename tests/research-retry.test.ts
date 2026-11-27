import{describe,it,expect,vi}from'vitest';
import{fetchResearchClosing,retryAfterMs}from'../src/domain/research-retry';
function setup(fetcher:typeof fetch){return{fetcher,beforeAttempt:vi.fn(async()=>{}),wait:vi.fn(async(_ms:number)=>{}),now:()=>0,onRetry:vi.fn(async()=>{})};}
describe('research read-only retry policy',()=>{
 it('honors source cooldown and the request scheduler before each attempt',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:429,headers:{'retry-after':'75'}})).mockResolvedValueOnce(new Response('{}'));
 const o=setup(fetcher);expect((await fetchResearchClosing('https://example.test',o)).status).toBe(200);expect(o.wait).toHaveBeenCalledWith(75000);expect(o.beforeAttempt).toHaveBeenCalledTimes(2);
 });
 it('recovers network errors with backoff',async()=>{const o=setup(vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(new Response('{}')));await fetchResearchClosing('https://example.test',o);expect(o.wait).toHaveBeenCalledWith(30000);});
 it('stops after three transient failures',async()=>{const o=setup(vi.fn().mockResolvedValue(new Response(null,{status:503})));await expect(fetchResearchClosing('https://example.test',o)).rejects.toThrow('HISTORY_RETRIES_EXHAUSTED_HTTP_503');expect(o.beforeAttempt).toHaveBeenCalledTimes(3);expect(o.wait.mock.calls.map(c=>c[0])).toEqual([30000,60000]);});
 it('never retries authorization failures or ignores long server cooldowns',async()=>{const denied=setup(vi.fn().mockResolvedValue(new Response(null,{status:403})));expect((await fetchResearchClosing('https://example.test',denied)).status).toBe(403);expect(denied.wait).not.toHaveBeenCalled();const long=setup(vi.fn().mockResolvedValue(new Response(null,{status:429,headers:{'retry-after':'1000'}})));await expect(fetchResearchClosing('https://example.test',long)).rejects.toThrow('HISTORY_LONG_COOLDOWN_REQUIRED');});
 it('parses numeric and HTTP-date retry delays',()=>{expect(retryAfterMs('20',0)).toBe(20000);expect(retryAfterMs('Thu, 01 Jan 1970 00:01:00 GMT',0)).toBe(60000);expect(retryAfterMs('bad',0)).toBe(0);});
});
